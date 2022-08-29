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
from post_processing import rotationMatrixToEulerAngles
from signal_filters import KalmanFilter1D, LowPassFilter

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
        self.sx = 640 #480
        self.sy = 240
        self.image_shape = (960, 1280) # H,W
        
        self.load_model()
    
    def load_model(self):
        self.fd = service.UltraLightFaceDetecion("weights/RFB-320.tflite",
                                        conf_threshold=0.9, nms_iou_threshold=0.5,
                                        nms_max_output_size=200)
        self.fa = service.DepthFacialLandmarks("weights/sparse_face.tflite")
        self.handler = getattr(service, 'pose')
        self.color = (224, 255, 255)

    def rcv_data(self, data: str, filter_list: list):
        
        xy_filter, angle_filter = filter_list
        # initailize
        output = ''
        angles = []
        rotate_matrix = []

        base64_data = data[0]
        imgdata = base64.b64decode(base64_data)
        frame = np.frombuffer(imgdata, np.uint8)
        frame = cv2.imdecode(frame, cv2.IMREAD_COLOR)

        # face detection
        boxes, _ = self.fd.inference(frame) # boxes, scores

        feed = frame.copy()

        for results in self.fa.get_landmarks(feed, boxes):
            _, params = results
            R = params[:3, :3].copy()
            # print(params[:, 3:])
            angle = rotationMatrixToEulerAngles(R)
            
            batch_roll, batch_pitch, batch_yaw = angle

            # Degree to Radians
            batch_roll = math.radians(batch_roll)
            batch_pitch = math.radians(batch_pitch)
            batch_yaw = math.radians(batch_yaw)

            # points = np.round(landmarks).astype(np.int)
            
            # x0, _ = tuple(points[1])
            # x1, _ = tuple(points[15])

            angles.append([batch_roll, batch_pitch, batch_yaw])
            rotate_matrix.append(R)
            

        angles = np.array(angles)
        
        # boxes (N, 4)
        number_samples = angles.shape[0]

        if number_samples >= 1:
            if number_samples > self.maximum_samples:
                number_samples = self.maximum_samples
            
            boxes = boxes[:number_samples]

            # Calc angle and scale by LPF
            zero_angle = np.zeros((self.maximum_samples, 3))
            zero_box = np.zeros((self.maximum_samples, 4))
            
            for i in range(number_samples):
                zero_angle[i] = angles[i]
                zero_box[i] = boxes[i]

            angle_filtered = angle_filter.filter(zero_angle)
            # xy_filtered = xy_filter.filter(zero_box)
            
            angle_filtered = np.round(angle_filtered, 2)

            for idx in range(number_samples):
                x_min, y_min, x_max, y_max = boxes[idx]
                # x_min, y_min, x_max, y_max = xy_filtered[idx]
                width = x_max - x_min
                height = y_max - y_min

                rotate_matrix = np.absolute(rotate_matrix)
                index_arr = np.array(rotate_matrix[idx])
                
                

                test_arr = np.array([width, height * 0.9, -0.03])
                
                # if index_arr[0, 1] > 0.4:
                #     index_arr[0, 1] = 0.4

                
                test_scale = test_arr @ index_arr
                
                vector = np.add.reduce(test_scale)
                
                cx = int(x_min + (width / 2)) + self.sx
                cy = int(y_min + (height / 2)) + self.sy

                if abs(self.prev_x[idx, 0] - cx) > 5:
                    self.prev_x[idx, 0] = cx

                if abs(self.prev_y[idx, 0] - cy) > 5:
                    self.prev_y[idx, 0] = cy
                
                norm_scale = vector / self.image_shape[1]
                
                if abs(self.prev_scales[idx, 0] - norm_scale) > 0.01:
                    self.prev_scales[idx, 0] = norm_scale
                
                center_x = str(round(self.prev_x[idx, 0])) + ','
                center_y = str(round(self.prev_y[idx, 0])) + ','
                roll = str(angle_filtered[idx, 0]) + ','
                pitch = str(angle_filtered[idx, 1]) + ','
                yaw = str(angle_filtered[idx, 2]) + ','
                scale = str(round(self.prev_scales[idx, 0], 2)) + ','

                face_results = center_x + center_y + scale + roll + pitch + yaw
                output += face_results

        
        return output
        
    async def loop_logic(self, websocket, path):
        print('init session')
        # scale_filter = LowPassFilterMulti(2., 1/10, self.maximum_samples, 1)
        xy_filter = LowPassFilterMulti(1., 1/10, self.maximum_samples, 4)
        angle_filter = LowPassFilterMulti(1., 1/20, self.maximum_samples, 3)
        # kalman_test = KalmanFilter1D()
        filter_lists = [xy_filter, angle_filter]
        while True:    
            # Wait data from client
            
            data = await asyncio.gather(websocket.recv())
            rcv_data = self.rcv_data(data=data, filter_list=filter_lists)
            if rcv_data != '':
                rcv_data = rcv_data[:-1]
            await websocket.send(rcv_data)

    def run_server(self):
        if USE_LOCAL:
            self.ssl_context = None
        else:
            self.ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            self.ssl_context.load_cert_chain(certfile=self.cert_dir, keyfile=self.key_dir, password=self.password)
        self.start_server = websockets.serve(self.loop_logic,
                                            port=self.port, ssl=self.ssl_context,
                                            max_size=262144,
                                            max_queue=8,
                                            read_limit=2**18,
                                            write_limit=2**8)
        asyncio.get_event_loop().run_until_complete(self.start_server)
        asyncio.get_event_loop().run_forever()
        
if __name__ == "__main__":
    USE_LOCAL = False
    
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
                                                default=None)
    parser.add_argument('--use_local', '-ul',
                                                type=bool,
                                                help='Launch Server Local Setting (127.0.0.1) [default : False]',
                                                default=False)
    
    args = parser.parse_args()
    
    cert = os.path.join(args.ssl_path, 'cert.pem')
    key = os.path.join(args.ssl_path, 'privkey.pem')

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