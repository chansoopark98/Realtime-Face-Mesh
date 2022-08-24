var express = require('express');
var http = require('http');

var app = express();

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');


app.use('/styles', express.static(__dirname + '/styles'));
app.use('/modules', express.static(__dirname + '/modules'));
app.use('/build', express.static('/home/park/park/NodeJS-based-DeepLearning/node_modules/three/build'));

var server = http.createServer(app);

app.get('/', function(req, res) {
    // res.send("Hello World!");
    console.log(
        __dirname
    );
    res.render(__dirname + "/test_page.html");    // index.html을 사용자에게 전달
});

server.listen(5556, 'localhost');
server.on('listening', function() {
    console.log('Express server started on port %s at %s', server.address().port, server.address().address);
});