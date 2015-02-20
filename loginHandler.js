var formidable = require('formidable');
var util = require('util');
var crypto = require('crypto');
var Cookies = require( "cookies" )
var keygrip = require("keygrip")
var MongoClient = require('mongodb').MongoClient;

var mongoUri = process.env.MONGOHQ_URL || 'mongodb://127.0.0.1:27017/health-database';

// Hardcoded user Information
var users = [
    { useremail: 'ishan1608@gmail.com', userpassword: '123456', cookiejar:[]},
    { useremail: 'ishan1608@live.com', userpassword: 'qwerty', cookiejar:[]}, 
    { useremail: 'ishanatmuzaffarpur@gmail.com', userpassword: 'asdfgh', cookiejar:[]}
];

var keys = keys = keygrip([ process.env.COOKIESECRET1 || "COOKIESECRET1", process.env.COOKIESECRET2 || "COOKIESECRET2" ], 'sha256', 'hex');

// Asynchronous function using callback
function userVerification(useremail, userpassword, callback) {
    // The database version
    MongoClient.connect(mongoUri, function(err, db) {
        if(err) {
            console.error('Error while connecting to the database');
            callback('no-database', null);
        } else {
            var collection = db.collection('users');
            collection.findOne({email: useremail, password: userpassword}, function(err, result) {
                if(!result) {
                    console.log('Cannnot find the username and password combination.');
                    callback('invalid-credentials', null);
                } else {
                    console.dir(result);
                    // Generate a new cookie
                    var date = new Date();
                    var hashString = useremail + date.toDateString() + date.getHours() + date.getMinutes() + date.getMilliseconds();
                    hashString = crypto.createHash('md5').update(hashString).digest("hex");
                    
                    // Adding it to the cookiejar
                    collection.update({email: useremail}, {$push: {cookiejar: hashString}}, function(err){
                        db.close();
                        if(err) {
                            console.error(err);
                            callback('update-error', null);
                        } else {
                            console.log('Updated successfully');
                            console.log(hashString);
                            callback(null, hashString);
                        }
                    });
                }
            });
        }
    });
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
        userVerification(fields.useremail, fields.userpassword, function(err, sessionCookie) {
            console.log('Login returned', sessionCookie);
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
//                return res.end();
                res.end();
            } else {
                console.log("Login failed with cookie : " + sessionCookie);
                res.writeHead(302, {'Location': '/index/?email=' + fields.useremail});
                res.end();
            }
//            res.end(util.inspect({fields: fields}));
        });
    });
}

function ensureAuthenticated(req, res, callback) {
    // Function to check whether the user is already authenticated or not.
    // Get the cookies email and session as argument validate them and calls callback email or false
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
        MongoClient.connect(mongoUri, function(err, db) {
            if(err) {
                console.error('Error connecting to database.');
                callback(false);
            } else {
                var collection = db.collection('users');
                collection.findOne({email: emailCookie, cookiejar: sessionCookie}, function(err, result) {
                    db.close();
                    if(!result) {
                        console.error('Could not find the session.');
                        callback(false);
                    } else {
                        console.log('Found login session');
                        callback(emailCookie);
                    }
                });
            }
        });
    } else {
//        console.log("Returning false because couldn't get all the cookies.");
        callback(false);
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
        // Removing cookie from the database
        MongoClient.connect(mongoUri, function(err, db) {
            if(err) {
                console.error('Cannot connect to database');
            } else {
                var collection = db.collection('users');
                collection.update({email: emailCookie}, {$pull: {cookiejar: sessionCookie}}, {w: 0});
                db.close();
            }
        });
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