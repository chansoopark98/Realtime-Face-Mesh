const GET_IMAGE_FLAG = '$$GETIMG';
const CLIENT_FLAG = '$$CLIENT';
const captureBtn = document.querySelector('#capture-btn');

function connectServer() {
    const wss = new WebSocket('wss://127.0.0.1:5503');

    wss.onmessage = (msg) => {
        console.log(msg.data)
    };

    wss.onopen = () => {
        wss.send(JSON.stringify(CLIENT_FLAG));
        console.log("connect successfully!");
    };

    wss.onclose = () => {
        console.log("disconneted")
        reject(false);
    };

    wss.onerror = () => {
        console.log("error occured! failed to connect server.")
        reject(false);
    };

    return {
        sendCaptureMsg: () => {
            wss.send(JSON.stringify(GET_IMAGE_FLAG));
        }
    } 
}

window.onload = () => {
    const server = connectServer();
    captureBtn.addEventListener('click', () => {
        server.sendCaptureMsg();
    });
}