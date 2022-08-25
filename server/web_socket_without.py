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

import pyzed.sl as sl
import sys

class ConfigureZedCamera(object):
    def __init__(self):

        self.zed = sl.Camera()
        print(self.zed)
        # Set configuration parameters
        input_type = sl.InputType()
        # print(len(sys.argv))
        # if len(sys.argv) >= 2 :
        
        self.init = sl.InitParameters()
        # self.init.camera_resolution = sl.RESOLUTION.HD1080
        self.init.depth_mode = sl.DEPTH_MODE.PERFORMANCE
        # self.init.coordinate_units = sl.UNIT.MILLIMETER

        self.runtime = sl.RuntimeParameters()
        self.runtime.sensing_mode = sl.SENSING_MODE.STANDARD

        self.image_size = self.zed.get_camera_information().camera_resolution
        self.image_size.width = self.image_size.width /2
        self.image_size.height = self.image_size.height /2

        self.depth_image_zed = sl.Mat(self.image_size.width, self.image_size.height, sl.MAT_TYPE.U8_C4)
        err = self.zed.open(self.init)
        if err != sl.ERROR_CODE.SUCCESS :
            print(repr(err))
            self.zed.close()
            exit(1)

        


class TCPServer(ConfigureZedCamera):
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
        
        self.load_model()
        # self.k4a = PyK4A(
        #     Config(
        #         color_resolution=pyk4a.ColorResolution.OFF,
        #         depth_mode=pyk4a.DepthMode.NFOV_UNBINNED,
        #         synchronized_images_only=False,
        #         disable_streaming_indicator=True,
        #         )
        # )
        # self.k4a.start()
        

    
    def load_model(self):
        self.fd = service.UltraLightFaceDetecion("weights/RFB-320.tflite",
                                        conf_threshold=0.9, nms_iou_threshold=0.3)
        self.fa = service.DepthFacialLandmarks("weights/sparse_face.tflite")

        self.handler = getattr(service, 'pose')
        self.color = (224, 255, 255)

    def rcv_data(self, data, websocket):
        # get depth frame
        err = self.zed.grab(self.runtime)
        # if err == sl.ERROR_CODE.SUCCESS :
        self.zed.retrieve_image(self.depth_image_zed, sl.VIEW.DEPTH, sl.MEM.CPU, self.image_size)
        depth_image_ocv = self.depth_image_zed.get_data()
        cv2.imshow("Depth", depth_image_ocv)
        cv2.waitKey(10)

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
            angle = pose(frame, results, (255, 102, 51)) # (3,)
            sparse(frame, results, (51, 255, 51))
            batch_roll, batch_pitch, batch_yaw = angle

            # Degree to Radians
            batch_roll = math.radians(batch_roll)
            batch_pitch = math.radians(batch_pitch)
            batch_yaw = math.radians(batch_yaw)
            
            angles.append([batch_roll, batch_pitch, batch_yaw])
        
        angles = np.array(angles)
        
        # boxes (N, 4)
        number_samples = angles.shape[0]
        
        # cv2.imshow('test', frame)
        # cv2.waitKey(1)

        # capture = k4a.get_capture()
        # img_color = capture.depth
        # print(img_color)

        if number_samples >= 1:

            if number_samples > self.maximum_samples:
                number_samples = self.maximum_samples

            for idx in range(number_samples):
                x_min, y_min, x_max, y_max = boxes[idx]
                width = x_max - x_min
                height = y_max - y_min

                center_x = int(x_min + (width / 2)) + self.sx
                center_y = int(y_min + (height / 2)) + self.sy

                
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

                print(self.prev_angles[idx])
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
    use_local = True

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