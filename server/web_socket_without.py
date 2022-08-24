from copyreg import constructor
import ssl
import asyncio
import websockets
import cv2
import numpy as np
import base64
import argparse
import service
import cv2
import math

from post_processing import pose


class TCPServer():
    def __init__(self, hostname, port, cert_dir, key_dir):
        super().__init__()
        self.hostname = hostname
        self.port = port
        self.cert_dir = cert_dir
        self.key_dir = key_dir

        self.sx = 880
        self.sy = 420
        self.load_model()

    
    def load_model(self):
        self.fd = service.UltraLightFaceDetecion("weights/RFB-320.tflite",
                                        conf_threshold=0.8)
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
            
            
            angle = pose(frame, results, self.color) # (3,)
            batch_roll, batch_pitch, batch_yaw = angle
            batch_roll = math.radians(batch_roll)
            batch_pitch = math.radians(batch_pitch)
            batch_yaw = math.radians(batch_yaw)
            
            angles.append([batch_roll, batch_pitch, batch_yaw])
            

        
        angles = np.array(angles)
        
        # boxes (N, 4)
        number_samples = boxes.shape[0]
        if number_samples >= 1:
            for idx in range(number_samples):
                x_min, y_min, x_max, y_max = boxes[idx]
            
                center_x = int(x_min + ((x_max-x_min) / 2)) + self.sx
                center_y = int(y_min + ((y_max-y_min) / 2)) + self.sy

                center_x = str(center_x) + ','
                center_y = str(center_y) + ','
                roll = str(round(angles[idx, 0], 3)) + ','
                pitch = str(round(angles[idx, 1], 3)) + ','
                yaw = str(round(angles[idx, 2], 3)) + ','

                face_results = center_x + center_y + roll + pitch + yaw
                output += face_results

            print(output)

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
        self.ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        self.ssl_context.load_cert_chain(self.cert_dir, self.key_dir)
        if use_local:
            self.ssl_context = None
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