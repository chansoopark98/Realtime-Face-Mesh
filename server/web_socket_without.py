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
import time

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
        self.prev_area = np.reshape(np.zeros(self.maximum_samples), (self.maximum_samples, 1))
        self.prev_angles = np.zeros((self.maximum_samples, 4))
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
        scale_filter, x_angle_filter, y_angle_filter,\
                                z_angle_filter, kalman_test= filter_list
        # initailize
        output = ''
        angles = []

        base64_data = data[0]
        imgdata = base64.b64decode(base64_data)
        frame = np.frombuffer(imgdata, np.uint8)
        frame = cv2.imdecode(frame, cv2.IMREAD_COLOR)

        # face detection
        boxes, _ = self.fd.inference(frame) # boxes, scores

        feed = frame.copy()

        for results in self.fa.get_landmarks(feed, boxes):
            landmarks, params = results
            R = params[:3, :3].copy()
            angle = rotationMatrixToEulerAngles(R)
            
            batch_roll, batch_pitch, batch_yaw = angle

            # Degree to Radians
            batch_roll = math.radians(batch_roll)
            batch_pitch = math.radians(batch_pitch)
            batch_yaw = math.radians(batch_yaw)

            points = np.round(landmarks).astype(np.int)
            
            x0, _ = tuple(points[1])
            x1, _ = tuple(points[15])
    
            test_arr = np.array([abs(int(x1 - x0)), 1, 1])
            R = np.absolute(R)
            test_arr = test_arr @ R    

            vector = np.add.reduce(test_arr)
            
            angles.append([batch_roll, batch_pitch, batch_yaw, vector])
        
        angles = np.array(angles)
        
        # boxes (N, 4)
        number_samples = angles.shape[0]

        if number_samples >= 1:

            if number_samples > self.maximum_samples:
                number_samples = self.maximum_samples

            for idx in range(number_samples):
                x_min, y_min, x_max, y_max = boxes[idx]
                width = x_max - x_min
                height = y_max - y_min
                
                center_x = int(x_min + (width / 2)) + self.sx
                center_y = int(y_min + (height / 2)) + self.sy

                current_x_angle = x_angle_filter.filter(angles[idx, 0])
                current_y_angle = y_angle_filter.filter(angles[idx, 1])
                current_z_angle = z_angle_filter.filter(angles[idx, 2])
                current_scale = scale_filter.filter((angles[idx, 3]) / self.image_shape[1])
                
                
                # center_x = self.x_trans_filter.filter(center_x)
                # center_y = self.y_trans_filter.filter(center_y)

                # print([0])
                # kalman_results = self.kalman_test.KalmanTracking(center_x, center_y)
                # center_x = kalman_results[0]
                # center_y = kalman_results[2]

                if abs(self.prev_x[idx] - center_x) > 2:
                    self.prev_x[idx] = center_x

                if abs(self.prev_y[idx] - center_y) > 2:
                    self.prev_y[idx] = center_y

                if abs(self.prev_angles[idx,0] - current_x_angle) >= 0.03:
                    self.prev_angles[idx,0] = current_x_angle
                if abs(self.prev_angles[idx,1] - current_y_angle) >= 0.03:
                    self.prev_angles[idx,1] = current_y_angle

                if abs(self.prev_angles[idx,2] - current_z_angle) >= 0.03:
                    self.prev_angles[idx,2] = current_z_angle

                current_scale = round(current_scale, 3)
                if abs(self.prev_angles[idx,3] - current_scale) >= 0.025:
                    self.prev_angles[idx,3] = current_scale

                
                center_x = str(self.prev_x[idx, 0]) + ','
                center_y = str(self.prev_y[idx, 0]) + ','
                scale = str(round(self.prev_angles[idx, 3], 2)) + ','
                roll = str(round(self.prev_angles[idx, 0], 2)) + ','
                pitch = str(round(self.prev_angles[idx, 1], 2)) + ','
                yaw = str(round(self.prev_angles[idx, 2], 2)) + ','

                face_results = center_x + center_y + scale + roll + pitch + yaw
                output += face_results
        
        return output
        
    async def loop_logic(self, websocket, path):
        scale_filter = LowPassFilter(2., 1/10)
        x_angle_filter = LowPassFilter(1., 1/20)
        y_angle_filter = LowPassFilter(1., 1/20)
        z_angle_filter = LowPassFilter(1., 1/20)
        kalman_test = KalmanFilter1D()

        filter_list = [scale_filter,
                       x_angle_filter,
                       y_angle_filter,
                       z_angle_filter,
                       kalman_test]
        while True:    
            # Wait data from client
            
            data = await asyncio.gather(websocket.recv())
            rcv_data = self.rcv_data(data=data, filter_list=filter_list)
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
                                            max_size=400000,
                                            max_queue=1,
                                            read_limit=2**22,
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