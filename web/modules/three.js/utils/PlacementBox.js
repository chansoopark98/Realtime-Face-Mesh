/**
 *  Copyright model-viewer. All Right Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'Licencse')
 *  you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
	Mesh,
	BufferGeometry,
	Float32BufferAttribute,
	PlaneGeometry,
	Vector2,
	MeshPhongMaterial
} from '../three.module.js';

const MIN_DECAY_MILLISECONDS = 0.001;
const DECAY_MILLISECONDS = 50;

const RADIUS = 0.1;
const LINE_WIDTH = 0.03;
const MAX_OPACITY = 0.75;
const SEGMENTS = 12;
const DELTA_PHI = Math.PI / (2 * SEGMENTS);
const vector2 = new Vector2();

const addCorner = (vertices, cornerX, cornerY) => {
    let phi = cornerX > 0 ? (cornerY > 0 ? 0 : -Math.PI / 2) :
        (cornerY > 0 ? Math.PI / 2 : Math.PI);
    for (let i = 0; i <= SEGMENTS; ++i) {
        vertices.push(cornerX + (RADIUS - LINE_WIDTH) * Math.cos(phi), cornerY + (RADIUS - LINE_WIDTH) * Math.sin(phi), 0, cornerX + RADIUS * Math.cos(phi), cornerY + RADIUS * Math.sin(phi), 0);
        phi += DELTA_PHI;
    }
};

class Damper {
    constructor(decayMilliseconds = DECAY_MILLISECONDS) {
        this.velocity = 0;
        this.naturalFrequency = 0;
        this.setDecayTime(decayMilliseconds);
    }
    setDecayTime(decayMilliseconds) {
        this.naturalFrequency =
            1 / Math.max(MIN_DECAY_MILLISECONDS, decayMilliseconds);
    }
    update(x, xGoal, timeStepMilliseconds, xNormalization) {
        const nilSpeed = 0.0002 * this.naturalFrequency;
        if (x == null || xNormalization === 0) {
            return xGoal;
        }
        if (x === xGoal && this.velocity === 0) {
            return xGoal;
        }
        if (timeStepMilliseconds < 0) {
            return x;
        }
        // Exact solution to a critically damped second-order system, where:
        // acceleration = this.naturalFrequency * this.naturalFrequency * (xGoal
        // - x) - 2 * this.naturalFrequency * this.velocity;
        const deltaX = (x - xGoal);
        const intermediateVelocity = this.velocity + this.naturalFrequency * deltaX;
        const intermediateX = deltaX + timeStepMilliseconds * intermediateVelocity;
        const decay = Math.exp(-this.naturalFrequency * timeStepMilliseconds);
        const newVelocity = (intermediateVelocity - this.naturalFrequency * intermediateX) * decay;
        const acceleration = -this.naturalFrequency * (newVelocity + intermediateVelocity * decay);
        if (Math.abs(newVelocity) < nilSpeed * Math.abs(xNormalization) &&
            acceleration * deltaX >= 0) {
            // This ensures the controls settle and stop calling this function instead
            // of asymptotically approaching their goal.
            this.velocity = 0;
            return xGoal;
        }
        else {
            this.velocity = newVelocity;
            return xGoal + intermediateX * decay;
        }
    }
}

/**
 * This class is a set of two coincident planes. The first is just a cute box
 * outline with rounded corners and damped opacity to indicate the floor extents
 * of a scene. It is purposely larger than the scene's bounding box by RADIUS on
 * all sides so that small scenes are still visible / selectable. Its center is
 * actually carved out by vertices to ensure its fragment shader doesn't add
 * much time.
 *
 * The child plane is a simple plane with the same extents for use in hit
 * testing (translation is triggered when the touch hits the plane, rotation
 * otherwise).
 */
 class PlacementBox extends Mesh {
    constructor(scene, side, bbox, bSize) {
        const geometry = new BufferGeometry();
        const triangles = [];
        const vertices = [];
        //const { size, boundingBox } = scene;
		const size = bSize;
		const boundingBox = bbox;
        const x = size.x / 2 - 0.05;
        const y = (side === 'back' ? size.y : size.z) / 2  - 0.05;
        addCorner(vertices, x, y);
        addCorner(vertices, -x, y);
        addCorner(vertices, -x, -y);
        addCorner(vertices, x, -y);
        const numVertices = vertices.length / 3;
        for (let i = 0; i < numVertices - 2; i += 2) {
            triangles.push(i, i + 1, i + 3, i, i + 3, i + 2);
        }
        const i = numVertices - 2;
        triangles.push(i, i + 1, 1, i, 1, 0);
        geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
        geometry.setIndex(triangles);
        super(geometry);
        this.side = side;
        const material = this.material;
        material.side = 2; // DoubleSide = 2
        material.transparent = true;
        material.opacity = 1;
        this.goalOpacity = 0;
        this.opacityDamper = new Damper();
        this.hitPlane =
            new Mesh(new PlaneGeometry(2 * (x + RADIUS), 2 * (y + RADIUS)), 
			new MeshPhongMaterial({ color: 0xffffff }));
        this.hitPlane.visible = false;
        this.add(this.hitPlane);
        boundingBox.getCenter(this.position);
        switch (side) {
            case 'bottom':
                this.rotateX(-Math.PI / 2);
                this.shadowHeight = boundingBox.min.y;
                this.position.y = this.shadowHeight;
                break;
            case 'back':
                this.shadowHeight = boundingBox.min.z;
                this.position.z = this.shadowHeight;
        }
        //scene.target.add(this);

		this.receiveShadow = false;
		this.castShadow = false;
    }
    /**
     * Get the world hit position if the touch coordinates hit the box, and null
     * otherwise. Pass the scene in to get access to its raycaster.
     */
    getHit(scene, screenX, screenY) {
        vector2.set(screenX, -screenY);
        this.hitPlane.visible = true;
        const hitResult = scene.positionAndNormalFromPoint(vector2, this.hitPlane);
        this.hitPlane.visible = false;
        return hitResult == null ? null : hitResult.position;
    }
    getExpandedHit(scene, screenX, screenY) {
        this.hitPlane.scale.set(1000, 1000, 1000);
        const hitResult = this.getHit(scene, screenX, screenY);
        this.hitPlane.scale.set(1, 1, 1);
        return hitResult;
    }
    /**
     * Offset the height of the box relative to the bottom of the scene. Positive
     * is up, so generally only negative values are used.
     */
    set offsetHeight(offset) {
        if (this.side === 'back') {
            this.position.z = this.shadowHeight + offset;
        }
        else {
            this.position.y = this.shadowHeight + offset;
        }
    }
    get offsetHeight() {
        if (this.side === 'back') {
            return this.position.z - this.shadowHeight;
        }
        else {
            return this.position.y - this.shadowHeight;
        }
    }
    /**
     * Set the box's visibility; it will fade in and out.
     */
    set show(visible) {
        this.goalOpacity = visible ? MAX_OPACITY : 0;
    }
    /**
     * Call on each frame with the frame delta to fade the box.
     */
    updateOpacity(delta) {
        const material = this.material;
        material.opacity =
            this.opacityDamper.update(material.opacity, this.goalOpacity, delta, 1);
        this.visible = material.opacity > 0;
    }
    /**
     * Call this to clean up Three's cache when you remove the box.
     */
    dispose() {
        var _a;
        const { geometry, material } = this.hitPlane;
        geometry.dispose();
        material.dispose();
        this.geometry.dispose();
        this.material.dispose();
        (_a = this.parent) === null || _a === void 0 ? void 0 : _a.remove(this);
    }
}

export { PlacementBox };
