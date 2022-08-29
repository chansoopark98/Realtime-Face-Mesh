import numpy as np
from numpy import transpose
from numpy.linalg import inv

class KalmanFilter1D(object):
    def __init__(self):
        self.dt = 1
        self.A = np.array([[1, self.dt, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, self.dt],
        [0, 0, 0, 1],
        ])
        self.H = np.array([
            [1, 0, 0, 0],
            [0, 0, 1, 0]
        ])

        self.Q = np.eye(4) 
        self.R = np.array([
            [50, 0],
            [0, 50]
        ])
        self.P = 100 * np.eye(4)

        self.x = np.array([0, 0, 0, 0])
    
    def KalmanTracking(self, x_, y_):
    
    
        xp = self.A @ self.x
        Pp = self.A @ self.P @ transpose(self.A) + self.Q
        
        K = Pp@transpose(self.H) @ inv(self.H@Pp@transpose(self.H) + self.R)
        
        z = (x_, y_)
        self.x = xp + K@(z - self.H@xp)
        self.P = Pp - K@self.H@Pp 
        
        return self.x

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