import ssl
import asyncio
from tkinter.messagebox import NO
import websockets
import cv2
import numpy as np
import base64
import mediapipe as mp
import json
import math

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(max_num_faces=5,
            min_detection_confidence=0.3,
            min_tracking_confidence=0.3)
mp_drawing = mp.solutions.drawing_utils
drawing_spec = mp_drawing.DrawingSpec(thickness=1, circle_radius=1)

class TCPServer():
    def __init__(self, hostname, port, cert_dir, key_dir):
        super().__init__()
        self.hostname = hostname
        self.port = port
        self.cert_dir = cert_dir
        self.key_dir = key_dir

        self.width = 2560
        self.height = 1440
        self.focal_length = 1 * self.width
        self.cam_matrix = np.array([[self.focal_length, 0, self.height/2],
                                    [0, self.focal_length, self.width/2],
                                    [0, 0, 1]])
        self.cam_matrix = np.array(self.cam_matrix)
        self.dist_matrix = np.zeros((4, 1), dtype=np.float64)
        self.prev_x = 0
        self.prev_y = 0
        self.prev_angle = [0, 0, 0]
        


    def rcv_data(self, data, websocket):
        base64_data = data[0]
        imgdata = base64.b64decode(base64_data)
        image = np.frombuffer(imgdata, np.uint8)
        image = cv2.imdecode(image, cv2.IMREAD_COLOR)
        
        cv2.imshow('test', image)
        cv2.waitKey(1)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        results = face_mesh.process(image)
        image.flags.writeable = True


        send_dict = []
        output = ''
        
        if results.multi_face_landmarks:
            detected_faces = results.multi_face_landmarks
            detected_nums = len(detected_faces)
            # for face_landmarks in results.multi_face_landmarks:
            for face_idx in range(detected_nums):
                face_2d = []
                face_3d = []
                depth = []
                test_x = 0
                test_y = 0

                h, w = self.height, self.width
                cx_min=  w
                cy_min = h
                cx_max= cy_max = 0
                for idx, lm in enumerate(detected_faces[face_idx].landmark):
                    # if idx == 33 or idx == 263 or idx == 1 or idx == 61 or idx == 291 or idx == 199:
                        cx, cy = int(lm.x * self.width), int(lm.y * self.height)
                        if cx<cx_min:
                            cx_min=cx
                        if cy<cy_min:
                            cy_min=cy
                        if cx>cx_max:
                            cx_max=cx
                        if cy>cy_max:
                            cy_max=cy
                        if idx == 1:
                            center_x = int(lm.x * self.width)
                            center_y = int(lm.y * self.height)

                            
                            if abs(self.prev_x - center_x) > 5:
                                self.prev_x = center_x
                            else:
                                center_x = self.prev_x

                            if abs(self.prev_y - center_y) > 5:
                                self.prev_y = center_y
                            else:
                                center_y = self.prev_y
                            
                            
                            # if abs(center_x - self.prev_x) > 10:
                            #     print('x  ', abs(center_x - self.prev_x))    
                            #     tmp_x = center_x
                            #     center_x = self.prev_x
                            #     self.prev_x = tmp_x
 
                                
                                
                            depth.append(lm.z)
                        
                        if idx == 94:
                            test_x = int(lm.x * self.width)
                        if idx == 324:
                            test_y = int(lm.y * self.width)
                            


                        x = int(lm.x * self.width)
                        y = int(lm.y * self.height)

                        
                        face_2d.append([x,y])
                        face_3d.append([x, y, lm.z])


                face_2d = np.array(face_2d, dtype=np.float64)
                face_3d = np.array(face_3d, dtype=np.float64)
                depth = np.array(depth, dtype=np.float64)
                depth = np.mean(depth)
                
                success, rot_vec, trans_vec = cv2.solvePnP(face_3d, face_2d, self.cam_matrix, self.dist_matrix)

                rmat, jac = cv2.Rodrigues(rot_vec)

                angle, mtxR, mtxQ, Qx, Qy, Qz = cv2.RQDecomp3x3(rmat)
                angle = list(angle)
                print(cx_min, )
                if abs(self.prev_angle[0] - angle[0]) > 0.001:
                    self.prev_angle[0] = angle[0]
                else:
                    angle[0] = self.prev_angle[0]

                if abs(self.prev_angle[1] - angle[1]) > 0.001:
                    self.prev_angle[1] = angle[1]
                else:
                    angle[1] = self.prev_angle[1]

                face_idx = str(face_idx) + ','
                scale = str(cx_max-cx_min) + ','
                center_x = str(center_x) + ','
                center_y = str(center_y) + ','
                x_rot = str(round(angle[0], 3)) + ','
                y_rot = str(round(angle[1], 3)) + ','
                z_rot = str(angle[2]) + ','
                depth = str(-round(depth, 5)) + ','
                
                face_results = face_idx + scale + center_x + center_y + x_rot + y_rot + z_rot + depth
                
                output += face_results

        else:
            output = ''
                
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