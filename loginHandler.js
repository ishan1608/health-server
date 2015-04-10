var formidable = require('formidable');
var util = require('util');
var crypto = require('crypto');
var Cookies = require( "cookies" )
var keygrip = require("keygrip")
var MongoClient = require('mongodb').MongoClient;
var fs = require('fs');
var nodemailer = require('nodemailer');
var url = require('url');

var mongoUri = process.env.MONGOHQ_URL || 'mongodb://127.0.0.1:27017/health-database';
var fromEmail = process.env.FROM_EMAIL || 'tempexp6@gmail.com';
var fromPassword = process.env.FROM_PASSWORD || 'TempExp@06';



var keys = keygrip([ process.env.COOKIESECRET1 || "COOKIESECRET1", process.env.COOKIESECRET2 || "COOKIESECRET2" ], 'sha256', 'hex');

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
        // Not planning to clear the email cookie so that we can remember who last logged in
//        cookies.set( "email", null, { signed: true } );
        
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

function logoutOthers(req, res) {
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
        // TODO: Must ensure authentication before continuing
        MongoClient.connect(mongoUri, function(err, db) {
            var collection = db.collection('users');
            collection.update({email: emailCookie}, {$set: {cookiejar: []}}, function(err) {
                if(err) {
                    console.error('Could not remove other');
                    db.close();
                    console.error('remove-error');
                    res.writeHead(500, {'Content-Type': 'text/plain;charset=utf-8;'});
                    res.end('An internal server error occured.');
                } else {
                    collection.update({email: emailCookie}, {$push: {cookiejar: sessionCookie}}, function(err) {
                        
                        if(err) {
                            console.error('Could not add the session cookie');
                            console.error('push-error');
                            res.writeHead(500, {'Content-Type': 'text/plain;charset=utf-8;'});
                            res.end('An internal server error occured.');
                            db.close();
                        } else {
                            console.log('Successfully logged out others. Not sending anything back to the client.');
                            res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8;'});
                            res.end('Successfully logged out all other sessions.');
                            db.close();
                            
                        }
                    });
                }
            });
        });
    } else {
        res.writeHead(401, {'ContentType': 'text/html;charset=utf-8', 'WWW-Authenticate': 'email, session'});
        res.write("<html><head></head><body>We couldn't figure out who you are.<br/>For all we know you could be trying to find a vlunerability in our system. Please <a href='/'>Login</a> to continue.</body></html>");
        res.end();
    }
    
    
};

function register(req, res) {
    // Serving the registration page
    fs.readFile('views/register.html', {'encoding': 'utf-8'}, function (err, data) {
        if (err) {
            console.log('Error occurred while reading');
            res.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'});
            res.write('There was an internal error on the server.\nPlease try again at a later time, or contact the system admins.');
        } else {
            // console.log('Sending the register page');
            res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
            res.write(data);
            res.end();
        }
    });
};

function registeruser(req, res) {
    console.log('Register user called');
    // TODO: Check if user already exists
    var form = formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        if(err) {
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.end('There was an error collecting the info given.');
        } else {
            // Store the user data into pending users
            MongoClient.connect(mongoUri, function(err, db) {
                if (err) {
                    res.writeHead(500, {'Content-Type': 'text/plain'});
                    res.end('There was an internal error, please contact the admin.');
                    db.close();
                } else {
                    // Check the existence of the user before registering
                    var collection = db.collection('users');
                    collection.findOne({email: fields.user_email}, function(err, doc) {
                        if(err) {
                            res.writeHead(500, {'Content-Type': 'text/plain'});
                            res.end('There was an internal error, please contact the admin.');
                            db.close();
                        } else {
                            if(doc != null) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                res.end(JSON.stringify({success: false, existing: true, sendError: false, requested: false}));
                                db.close();
                            } else {
                                var collection = db.collection('pendingUsers');
                                // Inserting the info of pending user
                                var pendingUserInfo = {};
                                pendingUserInfo.name = fields.user_name;
                                pendingUserInfo.email = fields.user_email;
                                pendingUserInfo.gender = fields.user_gender;
                                pendingUserInfo.password = fields.user_password;

                                // Generate a new pass
                                var date = new Date();
                                var pass = pendingUserInfo.email + date.toDateString() + date.getHours() + date.getMinutes() + date.getMilliseconds();
                                pass = crypto.createHash('md5').update(pass).digest("hex");

                                pendingUserInfo.pass = pass;
                                var registrationURL = req.headers.host + '/confirmUser?user_email=' + pendingUserInfo.email + '&pass=' + pendingUserInfo.pass;
                                        collection.insert(pendingUserInfo, function(err, result) {
                                    if (err) {
                                        res.writeHead(200, {'Content-Type': 'application/json'});
                                        res.end(JSON.stringify({success: false, existing: false, sendError: false, requested: true}));
                                        db.close();
                                    } else {
                                        // Sending mail to the user
                                        var transporter = nodemailer.createTransport({
                                            service: 'Gmail',
                                            auth: {
                                                user: fromEmail,
                                                pass: fromPassword
                                            }
                                        });
                                        transporter.sendMail({
                                            from: fromEmail,
                                            to: pendingUserInfo.email,
                                            subject: 'Complete Registration',
                                            text: registrationURL,
                                            html: '<p>To complete the <b>registration</b> <a  target="_blank" href="http://' + registrationURL + '">click here</a></p><p>If clicking on the above link didn\'t work. Copy and paste the following url into your browser :</p><p>' + registrationURL + '</p>'
                                        }, function(error, response){
                                            if(error){
                                                console.log('Failed in sending mail');
                                                res.writeHead(200, {'Content-Type': 'application/json'});
                                                res.end(JSON.stringify({success: false, existing: false, sendError: true, requested: false}));
                                                db.close();
                                            }else{
                                                console.log('Successful in sedning email');
                                                res.writeHead(200, {'Content-Type': 'application/json'});
                                                res.end(JSON.stringify({success: true, existing: false, sendError: false, requested: false}));
                                                db.close();
                                            }
                                        });
                                    }
                            });

                                
                                
                            }
                        }
                    });
                    
                }
            });
        }
        
        
        
//        res.writeHead(200, {'Content-Type': 'text/plain', 'charset': 'utf-8'});
//        res.write(fields.user_name + "\n" + fields.user_email + "\n" + fields.user_gender + "\n" + fields.user_password + "\n");
//        res.end('I am working on sending a verification email before completing the registration.'); 
    });
};

function confirmUser(req, res) {
//    res.writeHead(200, {'Content-Type': 'text/plain'});
//    res.end('Hello  ' + req.user_email + '\nI am working on making this website\'s functionality complete, day and well not days... just any time that I feel like.\nBe assured this will be up soon.\nYour pass key is ' + req.pass);
    var url_parts = url.parse(req.url, true);
    console.log(url_parts);
    if((url_parts.query.user_email == null) || (url_parts.query.pass == null)) {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write('pass:' + url_parts.query.pass + ' email: ' + url_parts.query.user_email );
        res.end('Info missing :\nEmail: ' + url_parts.query.user_email + '\nPass: ' + url_parts.query.pass);
    } else {
        // TODO: Check for user already registered
        
        // Checking for the user info in pending users
        MongoClient.connect(mongoUri, function(err, db) {
        var collection = db.collection('pendingUsers');
        collection.findOne({email: url_parts.query.user_email, pass: url_parts.query.pass}, {_id: 0}, function(err, pendingUserInfo){
            if(err) {
                res.writeHead(500, {'Content-Type': 'text/plain'});
                res.end('There was an error connecting to database, please contact admin.');
                db.close();
            } else {
                if(pendingUserInfo == null) {
                    res.writeHead(500, {'Content-Type': 'text/plain'});
                    res.end('Can\'t find user. The user may have already confirmed registration.' + 'Please contact admin.');
                    console.log('Can\'t find user. The user may have already confirmed registration.');
                    db.close();
                } else {
                    var collection = db.collection('users');
                    collection.insert(pendingUserInfo, function(err, userInfo){
                        if(err) {
                            res.writeHead(500, {'Content-Type': 'text/plain'});
                            res.end('Error while saving user information.' + 'Please contact admin.');
                            console.error('Error while saving user information.');
                            db.close();
                        } else {
                            // Successfully inserted
                            console.log('successfully registered');
                            
                            // Removing from pending users list
                            var collection = db.collection('pendingUsers');
                            console.log('userInfo');
                            console.dir(userInfo);
                            console.log('pendingUserIfo');
                            console.log(pendingUserInfo.email);
                            
                            collection.remove({email: url_parts.query.user_email}, function(err, removalResult) {
                                if(err) {
                                    console.dir(err);
                                    console.log('failed');
                                    db.close();
                                } else {
                                    console.dir(removalResult);
                                    if(removalResult > 0) {
                                        console.log('success');
                                        res.writeHead(200, {'Content-Type': 'text/html'});
                                        res.write('<html><head></head><body>Registered successfully. Please <a href="/">login</a>.</body></html>');
                                        res.end();
                                    }
                                    db.close();
                                }
                            });
                        }
                    });
                }
            }
        });
    });
    }
    
};

exports.loginLocal = loginLocal;
exports.ensureAuthenticated = ensureAuthenticated;
exports.logout = logout;
exports.logoutOthers = logoutOthers;
exports.register = register;
exports.registeruser = registeruser;
exports.confirmUser = confirmUser;