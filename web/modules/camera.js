/**
 *  @author XHI-NM <jeong.chiseo@tsp-xr.com>
 *  @description
 *  Camera function for get rear camerea with general wide-angle
 */

 let isIOS = null;
 let isMobile = null;
 
 function getLogTitle(text) {
     let base = "======================================";
     return (base + `\n${text}\n` +base);
 }
 
 
 function getUserAgent() {
     return navigator.userAgent.toLowerCase();
 }
 
 function getCameraSpecification() {
     return new Promise(async (resolve, reject) => {
         let cameraList = [];
         let focusDistanceMax = 0;
 
         if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
             const deviceList = await navigator.mediaDevices.enumerateDevices();
             console.log(deviceList);
             for (let i = 0; i < deviceList.length; i++) {
                 const device = deviceList[i];
     
                 if (device.kind === "videoinput") {
                     const deviceId = device.deviceId;
     
                     const constraints = {
                        //  audio: false,
                         video: true,
                        //  zoom: true,
                         depth: true
                     };
     
                     const stream = await navigator.mediaDevices.getUserMedia(constraints);
                     const supports = navigator.mediaDevices.getSupportedConstraints();
                    
            
                     
                     stream.getVideoTracks().forEach(track => {
                         const capabilities = track.getCapabilities();
     
                         if (capabilities.facingMode[0] == "environment") {
                             console.log(getLogTitle(device.label));
                             console.log(device);
                             console.log(capabilities);
 
                             let fd = capabilities.focusDistance;
 
                             if (fd.min > 0){
                                 if (focusDistanceMax < fd.max) {
                                     focusDistanceMax = fd.max;
                                     cameraList.unshift(deviceId);
                                 } else  {
                                     cameraList.push(deviceId);
                                 }
                                 
                             }
                         }
                     })
                     stream.getTracks().forEach(track => {
                         track.stop();
                     });
                 }
             }
             resolve(cameraList);
         } else {
             console.log("This device does not support web camera.");
             reject(cameraList);
         }
     });
 }
 
 function openCamera(baseVideo) {
    
     return new Promise((reserve, reject) => {
         let video = {
            //  minWidth: 1920,
            //  minHeight: 1080,
            //  width: 1920,
            //  height: 1080

            minWidth: 2560,
            minHeight: 1440,
            width: 2560,
            height: 1440
         }
     
        //  if (deviceId == "ios") {
        //      video.facingMode = "environment";
        //  }
        //  } else {
        //      video.deviceId = deviceId;
        //  }
     
         let constraints = {
             audio: false,
             video: video
         };

     
         navigator.mediaDevices.getUserMedia(constraints).then(stream => {
             stream.getVideoTracks().forEach(track => {
                
             });
             
             baseVideo.srcObject = stream;
             baseVideo.addEventListener("loadedmetadata", () => {
                 baseVideo.play();
                 reserve(true, stream);
             });
         }).catch("Open camera failed!");
     })
 }
 
 function getCamera(baseVideo) {
     const userAgent = getUserAgent();
 
    //  if (userAgent.match("iphone") || userAgent.match("ipad") || userAgent.match("ipod") || userAgent.match("mac")) {
    //      isIOS = true;
    //      isMobile = true;
    //     //  if (!userAgent.match("safari") || userAgent.match("naver") || userAgent.match("twitter")) {
    //     //      isIOS = false;
    //     //  }
    //  } else {
    //      isMobile = userAgent.match("Android") || userAgent.match("mobile");
    //  }
 
     getCameraSpecification().then((cameraList) => {
        //  let cameraId = "";
         console.log(cameraList);
         if (cameraList.length > 0) {
             cameraId = cameraList[0];
         }
        //  else if (isIOS) {
        //      cameraId = "ios";
        //  }

 
         openCamera(baseVideo).then((camAct, stream) => {
             if (camAct) {
                 return stream
             }
         })
     });
 }
 
 export {getCameraSpecification, getCamera}