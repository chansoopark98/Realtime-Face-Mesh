
import cv2
import numpy as np

import service
import cv2
from post_processing import pose, sparse, dense

if __name__ == "__main__":
    USE_LOCAL = True
    
    frame_width = 1280
    frame_height = 720
    capture = cv2.VideoCapture(0)
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, frame_width)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, frame_height)
    
    fd = service.UltraLightFaceDetecion("weights/RFB-320.tflite",
                                                 conf_threshold=0.8, nms_iou_threshold=0.5,
                                                 nms_max_output_size=200)
    # Facial landmark detection tflite converted model
    fa = service.DepthFacialLandmarks("weights/sparse_face.tflite")

    while cv2.waitKey(1) < 0:
        ret, frame = capture.read()


        # Face detection
        boxes, _ = fd.inference(frame) # boxes, scores

        # Facial landmark를 계산하기 위해 frame image 복사
        feed = frame.copy()

        raw_rgb = frame.copy()

        # Post processing
        for results in fa.get_landmarks(feed, boxes):
            pose(frame, results, (100, 50, 150))
            sparse(frame, results, (128, 255, 30))
            dense(frame, results, (0, 60, 200))


        # cv2.namedWindow("window", cv2.WND_PROP_ASPECT_RATIO)
        # cv2.setWindowProperty("window",cv2.WND_PROP_ASPECT_RATIO,cv2.WND_PROP_ASPECT_RATIO)

        vis_rgb = cv2.hconcat([frame, raw_rgb])
        cv2.imshow('window', vis_rgb)
        cv2.waitKey(1)