import ssl
import os
import argparse
import asyncio
import websockets
import cv2
import numpy as np
import base64
import service
import cv2
import math
from post_processing import rotationMatrixToEulerAngles, pose, sparse, dense

class LowPassFilterMulti(object):
    def __init__(self, cut_off_freqency, ts, maximum_samples, shape):
        self.ts = ts
        self.cut_off_freqency = cut_off_freqency
        self.maximum_samples = maximum_samples
        self.shape = shape
        self.tau = self.get_tau()

        self.prev_data = np.zeros((self.maximum_samples, self.shape))
        
    def get_tau(self):
        return 1 / (2 * np.pi * self.cut_off_freqency)

    def filter(self, data):
        val = (self.ts * data + self.tau * self.prev_data) / (self.tau + self.ts)
        self.prev_data = val
        return val


class TCPServer():
    def __init__(self, hostname, port, cert_dir, key_dir, password):
        super().__init__()
        self.hostname = hostname
        self.port = port
        self.cert_dir = cert_dir
        self.key_dir = key_dir
        self.password = password
        
        self.maximum_samples = 4
        self.prev_x = np.reshape(np.zeros(self.maximum_samples), (self.maximum_samples, 1))
        self.prev_y = np.reshape(np.zeros(self.maximum_samples), (self.maximum_samples, 1))
        self.prev_scales = np.zeros((self.maximum_samples, 1))
        self.sx = 480 #480
        self.sy = 120
        self.image_shape = (960, 1280) # H,W
        
        self.load_model()
    
    def load_model(self):
        # Face detection tflite converted model
        self.fd = service.UltraLightFaceDetecion("weights/RFB-320.tflite",
                                                 conf_threshold=0.8, nms_iou_threshold=0.5,
                                                 nms_max_output_size=200)
        # Facial landmark detection tflite converted model
        self.fa = service.DepthFacialLandmarks("weights/sparse_face.tflite")
        # Service handler
        # self.color = service.TrianglesMeshRender("/home/park/park/Realtime-Face-Mesh/server/asset/render.so",
        #                                         "/home/park/park/Realtime-Face-Mesh/server/asset/triangles.npy")
        # self.handler = getattr(service, 'mesh')
    
    def rcv_data(self, data: str, angle_filter: LowPassFilterMulti) -> str:
        """
            Args:
                Websocket API가 Request data를 수신한 뒤 decode 후 처리하는 함수
                data         (str)            : base64 encode string
                angle_filter (class instance) : Low pass filter 1D multi scalars
        """
        # 변수 초기화
        output = ''
        angles = []
        rotate_matrix = []
        
        # Base64 이미지를 받은 뒤 np.ndarray로 decode
        base64_data = data[0]
        imgdata = base64.b64decode(base64_data)
        frame = np.frombuffer(imgdata, np.uint8)
        frame = cv2.imdecode(frame, cv2.IMREAD_COLOR)
        frame = cv2.flip(frame, 1)
        # Face detection
        boxes, _ = self.fd.inference(frame) # boxes, scores
        
        # Cut off by boxes scale
        # box_cut_off = 5000 # min 15000
        # condition = ((boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])) > box_cut_off
        
        # mask = np.where(condition, True, False)
        # boxes = boxes[mask]

        # Clip by maximum samples
        n_boxes = boxes.shape[0]
        if n_boxes >= self.maximum_samples:
            boxes = boxes[:self.maximum_samples]

        # Facial landmark를 계산하기 위해 frame image 복사
        feed = frame.copy()

        # Post processing
        for results in self.fa.get_landmarks(feed, boxes):
            pose(frame, results, (100, 50, 150))
            sparse(frame, results, (128, 255, 30))
            dense(frame, results, (0, 60, 200))
            # mesh(frame, results, self.color)
            # Get 3x3 rotation matrix
            _, params = results
            R = params[:3, :3].copy()
            
            # 3x3 rotation matrix to euler angles
            angle = rotationMatrixToEulerAngles(R)
            
            x_rot, y_rot, z_rot = angle

            # Euler angles to Radians
            x_rot = math.radians(x_rot)
            y_rot = math.radians(y_rot)
            z_rot = math.radians(z_rot)
            
            # List append angles in radians for each axis
            angles.append([x_rot, y_rot, z_rot])
            # List append 3x3 rotation matrix
            rotate_matrix.append(R)
            
        # Python list to numpy array
        angles = np.array(angles)
        
        # Check the number of detected objects
        number_samples = angles.shape[0]

        # When more than one object is detected
        if number_samples >= 1:
            # Limit when the detected object is larger than the maximum detection limit
            if number_samples > self.maximum_samples:
                number_samples = self.maximum_samples
            
            # # Limit the number of detected faces
            # boxes = boxes[:number_samples]

            # Calculate angle by LPF
            zero_angle = np.zeros((self.maximum_samples, 3))
            for i in range(number_samples):
                zero_angle[i] = angles[i]
            angle_filtered = angle_filter.filter(zero_angle)
            angle_filtered = np.round(angle_filtered, 2)
            
            # Calculate objects' center x,y and return detection results
            for idx in range(number_samples):
                """
                    boxes -> (N, 4) : N is number of detections.
                    The maximum value of N is self.maximum_samples.
                """
                x_min, y_min, x_max, y_max = boxes[idx]

                # Calculate face boxes's width and height
                width = x_max - x_min
                height = y_max - y_min

                """ Calculate object's scale """
                # 3x3 rotation matrix convert to absolute (python list to numpy array)
                rotate_matrix = np.absolute(rotate_matrix)
                
                # Converts it to x, y, z vectors using the object's width and height values.
                test_arr = np.array([width, height, 1])
                
                # Restore the rotated vector using the rotation matrix.
                test_scale = test_arr @ rotate_matrix[idx]
                
                # X,Y,Z vector reducing 
                vector = np.add.reduce(test_scale) 
                

                # Compensation by the value rotated along the z-axis
                vector -= np.absolute(angle_filtered[idx, 2] * width)
                

                """Restore the x,y coordinates according to the size of 
                   the frame received through the Websocket"""
                cx = (((x_min + (width / 2)) / self.image_shape[1]) * 1600 ) + self.sx
                cy = (((y_min + (height / 2)) / self.image_shape[0]) *  1200 ) + self.sy
                
                
                """ Clipping by comparing the difference with the previous result """
                # Clip x
                if abs(self.prev_x[idx, 0] - cx) > 10:
                    self.prev_x[idx, 0] = cx

                # Clip y
                if abs(self.prev_y[idx, 0] - cy) > 10:
                    self.prev_y[idx, 0] = cy

                # Clip scale
                norm_scale = vector / self.image_shape[1]
                # print(norm_scale)
                if abs(self.prev_scales[idx, 0] - norm_scale) > 0.025:
                    self.prev_scales[idx, 0] = norm_scale
                
                """ Convert detection results (center x, y, angles, scale) to string """
                center_x = str(round(self.prev_x[idx, 0])) + ','
                center_y = str(round(self.prev_y[idx, 0])) + ','
                roll = str(angle_filtered[idx, 0]) + ','
                pitch = str(angle_filtered[idx, 1]) + ','
                yaw = str(angle_filtered[idx, 2]) + ','
                scale = str(round(self.prev_scales[idx, 0], 2)) + ','

                face_results = center_x + center_y + scale + roll + pitch + yaw
                output += face_results
        
        # cv2.namedWindow("window", cv2.WND_PROP_FULLSCREEN)
        # cv2.setWindowProperty("window",cv2.WND_PROP_FULLSCREEN,cv2.WINDOW_FULLSCREEN)

        # cv2.putText(frame, 'Detected humans : ', (50, 70), cv2.FONT_HERSHEY_SIMPLEX, 1.2,
        #                 (200, 50, 0), 3, cv2.LINE_AA)
        
        # cv2.putText(frame,  str(number_samples), (425, 70), cv2.FONT_HERSHEY_SIMPLEX, 1.2,
        #                 (5, 50, 255), 3, cv2.LINE_AA)

        # cv2.imshow('window', frame)
        # cv2.waitKey(1)
        return output
        
    async def loop_logic(self, websocket: websockets, path):
        angle_filter = LowPassFilterMulti(1., 1/20, self.maximum_samples, 3)
        
        while True:    
            # Wait data from client
            data = await asyncio.gather(websocket.recv())
            # Encode and calculate detection
            rcv_data = self.rcv_data(data=data, angle_filter=angle_filter)
            # Remove end of string ','
            if rcv_data != '':
                rcv_data = rcv_data[:-1]
            # Send to client
            await websocket.send(rcv_data)

    def run_server(self):
        if USE_LOCAL:
            self.ssl_context = None
        else:
            self.ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            self.ssl_context.load_cert_chain(certfile=self.cert_dir, keyfile=self.key_dir, password=self.password)
        self.start_server = websockets.serve(self.loop_logic,
                                            port=self.port, ssl=self.ssl_context,
                                            max_size=402144,
                                            max_queue=8,
                                            read_limit=2**20,
                                            write_limit=2**8)
        asyncio.get_event_loop().run_until_complete(self.start_server)
        asyncio.get_event_loop().run_forever()
        
if __name__ == "__main__":
    USE_LOCAL = True
    
    parser = argparse.ArgumentParser(description="Face Detection Server")
    parser.add_argument('--ssl_path', '-sp',
                                                type=str,
                                                help='SSL File Path [default : ../]',
                                                default='../')
    parser.add_argument('--port', '-p',
                                                type=int,
                                                help='SSL Port [default : 7777]',
                                                default=7777)
    parser.add_argument('--password', '-pw',
                                                type=str,
                                                help='SSL Password [default : None]',
                                                default='tsp190910')
    parser.add_argument('--use_local', '-ul',
                                                type=bool,
                                                help='Launch Server Local Setting (127.0.0.1) [default : False]',
                                                default=True)
    
    args = parser.parse_args()
    
    cert = os.path.join(args.ssl_path, 'ar.tsp-xr.com-crt.pem')
    key = os.path.join(args.ssl_path, 'ar.tsp-xr.com-key.pem')

    USE_LOCAL = args.use_local

    if USE_LOCAL:
        hostname = '127.0.0.1'
    else:
        hostname = '0.0.0.0'

    server = TCPServer(
        hostname = hostname,
        port = args.port,
        cert_dir = cert,
        key_dir = key,
        password = args.password
    )
    server.run_server()