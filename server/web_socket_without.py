import ssl
import asyncio
import websockets
import cv2
import numpy as np
import base64

class TCPServer():
    def __init__(self, hostname, port, cert_dir, key_dir):
        super().__init__()
        self.hostname = hostname
        self.port = port
        self.cert_dir = cert_dir
        self.key_dir = key_dir

        self.width = 2560
        self.height = 1440

    def rcv_data(self, data, websocket):
        base64_data = data[0]
        imgdata = base64.b64decode(base64_data)
        image = np.frombuffer(imgdata, np.uint8)
        image = cv2.imdecode(image, cv2.IMREAD_COLOR)
        
        cv2.imshow('test', image)
        cv2.waitKey(1)
        

    async def loop_logic(self, websocket, path):


        while True:
                
            # Wait data from client
            data = await asyncio.gather(websocket.recv())
            self.rcv_data(data=data, websocket=websocket)
            # if rcv_data != '':
            #     rcv_data = rcv_data[:-1]
            # await websocket.send(rcv_data)


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