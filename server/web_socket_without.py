import ssl
import asyncio
import websockets
import cv2
import numpy as np
import base64
import service
import cv2
import math

from post_processing import pose, sparse

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
        self.prev_angles = np.zeros((self.maximum_samples, 3))
        self.sx = 640
        self.sy = 240
        self.image_shape = (960, 1280) # H,W
        
        self.filter = LowPassFilter(1., 1/10)
        self.load_model()
    
    
    def load_model(self):
        self.fd = service.UltraLightFaceDetecion("weights/RFB-320.tflite",
                                        conf_threshold=0.9, nms_iou_threshold=0.3)
        self.fa = service.DepthFacialLandmarks("weights/sparse_face.tflite")

        self.handler = getattr(service, 'pose')
        self.color = (224, 255, 255)


    def rcv_data(self, data, websocket):
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
            angle, _ = pose(frame, results, (255, 102, 51)) # (3,)
            sparse(frame, results, (51, 255, 51))
            batch_roll, batch_pitch, batch_yaw = angle

            # Degree to Radians
            batch_roll = math.radians(batch_roll)
            batch_pitch = math.radians(batch_pitch)
            batch_yaw = math.radians(batch_yaw)

            points = np.round(results[0]).astype(np.int)

                    

            

            cv2.line(frame, tuple(points[0]), tuple(points[4]), (255, 0, 0), 5)
            cv2.line(frame, tuple(points[12]), tuple(points[16]), (0, 0, 255), 5)

            rot = batch_roll
            # print(batch_roll, batch_pitch)
            # if batch_pitch < 0:
            #     rot = batch_roll
            x0, _ = tuple(points[0])
            x1, _ = tuple(points[16])

            vector = abs(int(((x1 - x0) * math.cos(rot))))

            cv2.circle(frame, (x0, 250), 10, (255, 0, 0), -1)
            cv2.circle(frame, (x1, 250), 10, (0, 0, 255), -1)
            
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

                x_scale = (angles[idx, 3] + width) / self.image_shape[1]
                
                order = 6
                fs = 30.0       
                cutoff = 3.667  
            

                # filter_x_scale = butter_lowpass_filter(x_scale, cutoff, fs, order)
                filter_x_scale = self.filter()

                print(x_scale, filter_x_scale)

                cv2.line(frame, (int(x_min), 250), (int(x_max), 250), (0, 0, 255), 5)
                

                if abs(self.prev_x[idx] - center_x) > 5:
                    self.prev_x[idx] = center_x

                if abs(self.prev_y[idx] - center_y) > 5:
                    self.prev_y[idx] = center_y

                if abs(self.prev_angles[idx, 0] - angles[idx, 0]) >= 0.08:
                    self.prev_angles[idx, 0] = angles[idx, 0]

                if abs(self.prev_angles[idx, 1] - angles[idx, 1]) >= 0.08:
                    self.prev_angles[idx, 1] = angles[idx, 1]
                
                if abs(self.prev_angles[idx, 2] - angles[idx, 2]) >= 0.08:
                    self.prev_angles[idx, 2] = angles[idx, 2]

                # print(self.prev_angles[idx])
                # Normalize scale
                scaled_width = width / self.image_shape[1]
                scaled_height = height / self.image_shape[0]
                area = scaled_width * scaled_height

                center_x = str(self.prev_x[idx, 0]) + ','
                center_y = str(self.prev_y[idx, 0]) + ','
                area = str(round(area, 2)) + ','
                roll = str(round(self.prev_angles[idx, 0], 2)) + ','
                pitch = str(round(self.prev_angles[idx, 1], 2)) + ','
                yaw = str(round(self.prev_angles[idx, 2], 2)) + ','



                face_results = center_x + center_y + area + roll + pitch + yaw
                output += face_results

            # print(output)
        # print(output)
        cv2.imshow('test', frame)
        cv2.waitKey(1)
        return output
        

    async def loop_logic(self, websocket, path):
        while True:    
            # Wait data from client
            data = await asyncio.gather(websocket.recv())
            rcv_data = self.rcv_data(data=data, websocket=websocket)
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
    # server.save_model()
    server.run_server()