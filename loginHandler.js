var formidable = require('formidable');
var util = require('util');
var crypto = require('crypto');
var Cookies = require( "cookies" )
var keygrip = require("keygrip")

// Hardcoded user Information
var users = [
    { useremail: 'ishan1608@gmail.com', userpassword: '123456', cookiejar:[]},
    { useremail: 'ishan1608@live.com', userpassword: 'qwerty', cookiejar:[]}, 
    { useremail: 'ishanatmuzaffarpur@gmail.com', userpassword: 'asdfgh', cookiejar:[]}
];

var keys = keys = keygrip([ process.env.COOKIESECRET1 || "COOKIESECRET1", process.env.COOKIESECRET2 || "COOKIESECRET2" ], 'sha256', 'hex');

function userVerification(useremail, userpassword) {
    // Checks for the validation of email and password and returns a new cookie, and stores the cookie as valid cookies
    var totalUsers = users.length;
    for(var i = 0; i < totalUsers; i++) {
        if(users[i].useremail === useremail) {
            if(users[i].userpassword === userpassword) {
                // Generate a new cookie
                var date = new Date();
                var hashString = useremail + date.toDateString() + date.getHours() + date.getMinutes() + date.getMilliseconds();
                hashString = crypto.createHash('md5').update(hashString).digest("hex");
                // Adding it to the cookiejar
                users[i].cookiejar.push(hashString);
                console.log(util.inspect(users))
                return hashString;
            } else {
                return null;
            }
        }
    }
    return null;
}

// Local login using emailId and password combination
function loginLocal(req, res) {
//    console.log('loginLocal called');
//    res.writeHead(302, {'Location': '/dashboard', 'Content-Type': 'text/plain; charset=utf-8'});
//    res.write('Redirecting.......');
//    res.end();
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        // Need to set cookies on my own. For now I will test using hardocded users and hardocded cookie

        var sessionCookie = userVerification(fields.useremail, fields.userpassword);
        if(sessionCookie) {
            console.log("Login successful with sessionCookie : " + sessionCookie);
            // Set the cookie in the client's browser
            // Two cookies : email, session
//            keys = keygrip([ process.env.COOKIESECRET1 || "COOKIESECRET1", process.env.COOKIESECRET2 || "COOKIESECRET2" ], 'sha256', 'hex');
            // Moved keys to top
//            console.log(keys);
            var cookies = new Cookies( req, res, keys);
            
            // setting email cookie
            cookies.set( "email", fields.useremail, { signed: true } );
            
            // setting session cookie
            cookies.set( "session", sessionCookie, { signed: true } );
            
            // Redirect the user then
            res.writeHead(302, {'Location': '/dashboard'});
            return res.end();
        } else {
            console.log("Login failed with cookie : " + sessionCookie);
            res.writeHead(302, {'Location': '/index/?email=' + fields.useremail});
        }
        res.end(util.inspect({fields: fields}));
    });
}

function ensureAuthenticated(req, res) {
    // Function to check whether the user is already authenticated or not.
    // Get the cookies email and session as argument validate them and return true or false.
    var cookies = new Cookies(req, res, keys);
    var cookieError = false;
    try {
        var emailCookie = cookies.get("email", {signed: true});
        var sessionCookie = cookies.get("session", {signed: true});
        console.log("emailCookie : " + emailCookie);
        console.log("sessionCookie : " + sessionCookie);
//        console.log("typeof(sessionCookie) "+ typeof(sessionCookie));
    } catch(error) {
        cookieError = true;
//        console.log("Couldn't find any cookie");
    }
    
    if(!cookieError) {
        var totalUsers = users.length;
//        console.log("totalUsers" + totalUsers);
        for( var i=0; i < totalUsers; i++) {
            if(users[i].useremail === emailCookie) {
//                console.log("users[i].useremail: " + users[i].useremail);
                var cookieJar = users[i].cookiejar;
                var cookieJarLength = cookieJar.length;
                console.log("cookieJar " + cookieJar);
//                console.log("users[i].cookiejar.length " + cookieJarLength);
                for(var j = 0; j < cookieJarLength; j++ ) {
//                    console.log("cookieJar[j] "+ cookieJar[j]);
                    if(cookieJar[j] === sessionCookie) {
//                        console.log("Cookie matched");
                        return emailCookie;
                    }
                }
//                console.log("No cookie found");
                return false;
            }
        }
        // User doesn't exists
//        console.log("User doesn't exists");
        return false;
    } else {
//        console.log("Returning false because couldn't get all the cookies.");
        return false;
    }
}

function logout(req, res) {
    // Get the cookie and remove it from the jar
    var cookies = new Cookies(req, res, keys);
    try {
        var emailCookie = cookies.get("email", {signed: true});
        // Clearing the cookie
        cookies.set( "email", null, { signed: true } );
        
        var sessionCookie = cookies.get("session", {signed: true});
        cookies.set( "session", null, { signed: true } );
        
        console.log("emailCookie : " + emailCookie);
        console.log("sessionCookie : " + sessionCookie);
//        console.log("typeof(sessionCookie) "+ typeof(sessionCookie));
        var totalUsers = users.length;
        for( var i = 0; i < totalUsers; i++) {
            if(users[i].useremail === emailCookie) {
                var cookieJar = users[i].cookiejar;
                
                console.log("cookieJar " + cookieJar);
                var cookiePosition = cookieJar.indexOf(sessionCookie);
                if(cookiePosition != -1) {
                    cookieJar.splice(cookiePosition, 1);
                }
                console.log("cookieJar " + cookieJar);
            }
        }
    } catch(error) {
        console.log("Couldn't find any cookie, nothing to logout.");
    }
    // Redirecting to index page for login
    res.writeHead(302, {'Location': '/'});
    res.end();
}

exports.loginLocal = loginLocal;
exports.ensureAuthenticated = ensureAuthenticated;
exports.logout = logout;