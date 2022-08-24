const tf = require('@tensorflow/tfjs')

async function load_model(){
    const model = await tf.loadLayersModel('assets/converted_tfjs/')
}

tf.setBackend('webgl');
console.log('tf js load');
export {load_model}