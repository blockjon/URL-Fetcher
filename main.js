/**
 *
 * On my mac, I start the program like this:
 * sudo node main.js
 * 
 * Example Valid Request:
 * http://127.0.0.1/?href=http%3A%2F%2Fi2.cdn.turner.com%2Fcnn%2Fdam%2Fassets%2F120815112157-evexp-endo-frc-gunman-identified-00003313-c1-main.jpg
 * 
 * Example Bogus Request:
 * http://127.0.0.1/?href=http%3A%2F%2Fi2.cdn
 * 
 * Many web applications need to be able to fetch content from user-supplied 
 * URLs. Using a language of your choice, implement an RPC service that fetches 
 * the contents of untrusted URLs.
 *
 * The service should expose an interface to the web application using either 
 * Thrift or HTTP. It should be able to handle malicious users, misbehaving 
 * servers, and access from multiple clients simultaneously. (You can assume 
 * the client itself is trusted, though.)
 */

var http = require('http'),
    url = require('url'),
    crypto = require('crypto'),
    exec = require('child_process').exec,
    sys = require('sys'),
    fs = require('fs');
    
// Project configs.
var DOWNLOAD_DIR = __dirname + "/downloads";
var MAX_FILE_SIZE = 100 * 1024;
var HTTP_FETCH_MILLISECOND_TIMEOUT = 20*1000;

// Warms up the enviornment.
var bootstrap = function(successCallback) {

    /**
     * We will be downloading the files to a directory, so make sure it's there
     */
    var mkdir = 'mkdir -p ' + DOWNLOAD_DIR;
    var child = exec(mkdir, function(err, stdout, stderr) {
        if (err) {
            throw err;
        } else {
            successCallback();
        }
    });
    
};

/**
 * Determine if the string passed is of a URL format we consider to be safe.
 * @return {boolean}
 */
var isSafeURL = function(testURL) {
    // test for safe url's here.
    return true;
};

// Create the web server.
simpleWebServer = http.createServer(function(request, response) {

    // Load the URL into an object.
    var urlObject = url.parse(request.url, true);

    // What is the object that the client is interested in us downloading?
    var href = urlObject.query.href;
    
    // Proceed if the origin URL is thought to be safe.
    if(isSafeURL(href)) {
        
        // Hash the filename so we know its safe as we write to disk.
        var md5Filename = crypto.createHash('md5').update(href).digest('hex');
        
        // Where is the file in the local filesystem?
        var streamTargetFile = DOWNLOAD_DIR + "/" + md5Filename;
        
        // Function to download file using HTTP.get
        var downloadTheFile = function(fileURL) {
            
            var options = {
                host: url.parse(fileURL).host,
                port: url.parse(fileURL).port,
                path: url.parse(fileURL).pathname,
                method : 'GET'
            };

            // Make an nice filename.
            var file_name = url.parse(fileURL).pathname.split('/').pop();

            // Create a stream used to download the file in chunks.
            var file = fs.createWriteStream(streamTargetFile);

            // Tracks size of downloaded file in bytes.
            var downloadSize = 0;

            // Reuseable function to stop a file download HTTP request.
            var stopFileDownload = function(httpRequest) {
                
                console.log("stopping...");
                
                // Abort the request.
                httpRequest.abort();

                // Close out the writable stream.
                file.end();
                
                // Delete the file.
                fs.unlink(streamTargetFile, function (err) {
                    
                    if (err) {
                        throw err;
                    } else {
                        console.log("Removed " + streamTargetFile);                            
                    }
                    
                });
                
            };
            
            // Fire up an HTTP request.
            var httpRequest = http.get(options, function(httpClientResponse) {
               
                httpClientResponse.on('data', function (data) {
                    
                    // Keep track of how big this thing is.
                    downloadSize += data.length;

                    // If the file content is too big, bork.
                    if(downloadSize > MAX_FILE_SIZE) {

                        stopFileDownload(httpRequest);

                        // Send back the response.
                        response.end("Error: " + file_name + " exceeds our max file size of " + MAX_FILE_SIZE);

                    } else {

                        // Add this newest data to the file.
                        file.write(data);

                    }    
                });

                httpClientResponse.on('end', function() {

                    // Bam! We're done!
                    file.end();

                    // Send back the response.
                    response.end(file_name + ' downloaded to ' + DOWNLOAD_DIR + " as " + md5Filename);

                });

                
            });
            
            // Handle errors such as requests to bogus URL's.'
            httpRequest.on('error', function (e) {
                console.log("Couln't complete HTTP request: " + e.message);
                response.end("Unable to complete the request for your file. Check your request and try again.");
            });

            // If it takes too long to respond, stop waiting.
            httpRequest.on('socket', function (socket) {
                socket.setTimeout(HTTP_FETCH_MILLISECOND_TIMEOUT, function() {
                    stopFileDownload(httpRequest);
                    response.end("It took more than " + HTTP_FETCH_MILLISECOND_TIMEOUT + " milliseconds for us to fetch the remote object off of the origin server.");
                });  
            });
            
        };
        
        // Do the file download.
        downloadTheFile(href);
        
    }

});

// Start the critical services and then launch the webserver.
bootstrap(function() {
    
    // Start the web server.
    simpleWebServer.listen(80);
    
    // Let the console know its gametime.
    console.log("Stripe.com 'Fetching' Example Web Server Started.");
    console.log("Jonathan Block <block.jon@gmail.com>");
    
});