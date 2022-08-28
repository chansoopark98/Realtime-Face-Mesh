import ssl
import asyncio
import websockets
import cv2
import numpy as np
import base64
import service
import cv2
import math

from post_processing import pose, sparse, rotationMatrixToEulerAngles

class LowPassFilter(object):
    def __init__(self, cut_off_freqency, ts):
        self.ts = ts
        self.cut_off_freqency = cut_off_freqency
        self.tau = self.get_tau()

        self.prev_data = 0.
        
    def get_tau(self):
        return 1 / (2 * np.pi * self.cut_off_freqency)

    def filter(self, data):
        val = (self.ts * data + self.tau * self.prev_data) / (self.tau + self.ts)
        self.prev_data = val
        return val


# class LowPassFilter(object):
#     def __init__(self, alpha):
#         self.prevX = 0
#         self.alpha = alpha
    
#     def filter(self, x):
#         # low pass filter 
#         x_lpf = self.alpha * self.prevX + (1 - self.alpha)*x
#         # 이전 스텝 값 갱신
#         self.prevX = x_lpf
#         return x_lpf  


class TCPServer():
    def __init__(self, hostname, port, cert_dir, key_dir):
        super().__init__()
        self.hostname = hostname
        self.port = port
        self.cert_dir = cert_dir
        self.key_dir = key_dir
        
        self.maximum_samples = 2
        self.prev_x = np.reshape(np.zeros(self.maximum_samples), (self.maximum_samples, 1))
        self.prev_y = np.reshape(np.zeros(self.maximum_samples), (self.maximum_samples, 1))
        self.prev_area = np.reshape(np.zeros(self.maximum_samples), (self.maximum_samples, 1))
        self.prev_angles = np.zeros((self.maximum_samples, 4))
        self.sx = 640
        self.sy = 240
        self.image_shape = (960, 1280) # H,W
        
        self.scale_filter = LowPassFilter(1/5., 1/20)
        self.x_trans_filter = LowPassFilter(1., 1/20)
        self.y_trans_filter = LowPassFilter(1., 1/20)
        self.x_angle_filter = LowPassFilter(1., 1/20)
        self.y_angle_filter = LowPassFilter(1., 1/20)
        self.z_angle_filter = LowPassFilter(1., 1/20)
        # self.scale_filter =   LowPassFilter(0.8)
        # self.x_trans_filter = LowPassFilter(0.8)
        # self.y_trans_filter = LowPassFilter(0.8)
        # self.x_angle_filter = LowPassFilter(0.8)
        # self.y_angle_filter = LowPassFilter(0.8)
        # self.z_angle_filter = LowPassFilter(0.8)
        self.load_model()
    
    def load_model(self):
        self.fd = service.UltraLightFaceDetecion("weights/RFB-320.tflite",
                                        conf_threshold=0.9, nms_iou_threshold=0.5)
        self.fa = service.DepthFacialLandmarks("weights/sparse_face.tflite")
        self.handler = getattr(service, 'pose')
        self.color = (224, 255, 255)

    def rcv_data(self, data):
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
            # sparse(frame, results, (0, 0, 0))
            # pose(frame, results, (127, 0, 255))
            landmarks, params = results
            R = params[:3, :3].copy()
            angle = rotationMatrixToEulerAngles(R)

            batch_roll, batch_pitch, batch_yaw = angle

            # Degree to Radians
            batch_roll = math.radians(batch_roll)
            batch_pitch = math.radians(batch_pitch)
            batch_yaw = math.radians(batch_yaw)

            points = np.round(landmarks).astype(np.int)
            
            x0, y0 = tuple(points[1])
            x1, y1 = tuple(points[15])
            

            x_angle = batch_roll
            y_angle = batch_pitch

            if batch_pitch > 0:
                y_angle = -batch_pitch
            if batch_roll > 0:
                x_angle = -batch_roll

            x_vector = abs(int(((x1 - x0) * (1 + (1 - math.cos(x_angle))))))
            y_vector = abs(int(((y1 - y0) * (1 - math.sin(y_angle)))))
            
            vector = int((x_vector + y_vector))
            
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
                
                center_x = int(x_min + (width / 2)) 
                center_y = int(y_min + (height / 2))

                center_x += self.sx
                center_y += self.sy


                current_x_angle = self.x_angle_filter.filter(angles[idx, 0])
                current_y_angle = self.y_angle_filter.filter(angles[idx, 1])
                current_z_angle = self.z_angle_filter.filter(angles[idx, 2])
                current_scale = self.scale_filter.filter((angles[idx, 3]) / self.image_shape[1])
                
                current_scale = round(current_scale, 2)
                
                
                center_x = self.x_trans_filter.filter(center_x)
                center_y = self.y_trans_filter.filter(center_y)
                if abs(self.prev_x[idx] - center_x) > 5:
                    self.prev_x[idx] = center_x

                if abs(self.prev_y[idx] - center_y) > 5:
                    self.prev_y[idx] = center_y
                


                if abs(self.prev_angles[idx,0] - current_x_angle) >= 0.03:
                    self.prev_angles[idx,0] = current_x_angle
                if abs(self.prev_angles[idx,1] - current_y_angle) >= 0.03:
                    self.prev_angles[idx,1] = current_y_angle

                if abs(self.prev_angles[idx,2] - current_z_angle) >= 0.03:
                    self.prev_angles[idx,2] = current_z_angle

                if abs(self.prev_angles[idx,3] - current_scale) >= 0.02:
                    self.prev_angles[idx,3] = current_scale

                print(current_scale, self.prev_x[idx, 0], self.prev_y[idx, 0])
                
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
        while True:    
            # Wait data from client
            data = await asyncio.gather(websocket.recv())
            rcv_data = self.rcv_data(data=data)
            if rcv_data != '':
                rcv_data = rcv_data[:-1]
            await websocket.send(rcv_data)

    def run_server(self):
        if use_local:
            self.ssl_context = None
        else:
            self.ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            self.ssl_context.load_cert_chain(self.cert_dir, self.key_dir)
        self.start_server = websockets.serve(self.loop_logic,
                                             port=self.port, ssl=self.ssl_context,
                                             max_size=400000,
                                             max_queue=1,
                                             read_limit=2**22,
                                             write_limit=2**8)
        asyncio.get_event_loop().run_until_complete(self.start_server)
        asyncio.get_event_loop().run_forever()
        
if __name__ == "__main__":
    use_local = False

    if use_local:
        hostname = '127.0.0.1'
    else:
        hostname = '0.0.0.0'

    server = TCPServer(
        hostname = hostname,
        port = 7777,
        cert_dir = '../cert.pem',
        key_dir = '../privkey.pem'
    )
    server.run_server()