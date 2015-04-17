var formidable = require('formidable');
var util = require('util');
var crypto = require('crypto');
var Cookies = require( "cookies" )
var keygrip = require("keygrip")
var MongoClient = require('mongodb').MongoClient;
var fs = require('fs');
var nodemailer = require('nodemailer');
var url = require('url');
var smtpTransport = require('nodemailer-smtp-transport');

var mongoUri = process.env.MONGOHQ_URL || 'mongodb://127.0.0.1:27017/health-database';
var fromEmail = process.env.FROM_EMAIL || 'tempexp6@gmail.com';
var fromPassword = process.env.FROM_PASSWORD || 'TempExp@06';

var keys = keygrip([ process.env.COOKIESECRET1 || "COOKIESECRET1", process.env.COOKIESECRET2 || "COOKIESECRET2" ], 'sha256', 'hex');

function checkUser(req, res) {
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        if(err) {
            res.writeHead(500, {'Content-Type': 'application/json'});
            console.log(JSON.stringify({error: true, databaseError: false, user: null, description: 'form-error'}));
            res.end(JSON.stringify({error: true, databaseError: false, user: null, description: 'form-error'}));
        } else {
            if(fields.email == undefined) {
                // Not Acceptable format
                res.writeHead(406, {'Content-Type': 'application/json'});
                console.log(JSON.stringify({error: true, databaseError: false, user: null, description: 'email-missing'}));
                res.end(JSON.stringify({error: true, databaseError: false, user: null, description: 'email-missing'}));
            } else {
                // Connecting to database
                MongoClient.connect(mongoUri, function(err, db) {
                    if(err) {
                        res.writeHead(500, {'Content-Type': 'application/json'});
                        console.log(JSON.stringify({error: true, databaseError: true, user: null, description: 'database-connection-error'}));
                        res.end(JSON.stringify({error: true, databaseError: true, user: null, description: 'database-connection-error'}));
                        db.close();
                    } else {
                        var collection = db.collection('users');
                        collection.findOne({email: fields.email}, function(err, result) {
                            if(err) {
                                res.writeHead(500, {'Content-Type': 'application/json'});
                                console.log(JSON.stringify({error: true, databaseError: true, user: null, description: 'database-find-error'}));
                                res.end(JSON.stringify({error: true, databaseError: true, user: null, description: 'database-find-error'}));
                                db.close();
                            } else {
                                if(result == null) {
                                    // user not found
                                    res.writeHead(404, {'Content-Type': 'application/json'});
                                    console.log(JSON.stringify({error: true, databaseError: false, user: null, description: 'user-nonexistent'}));
                                    res.end(JSON.stringify({error: true, databaseError: false, user: null, description: 'user-nonexistent'}));
                                    db.close();
                                } else {
                                    // User already registered
                                    res.writeHead(500, {'Content-Type': 'application/json'});
                                    console.log(JSON.stringify({error: false, databaseError: false, user: result.email, description: 'user-found'}));
                                    res.end(JSON.stringify({error: false, databaseError: false, user: result.email, description: 'user-found'}));
                                    db.close();
                                }
                            }
                        });
                    }
                });
            }
        }
    });
}

function resgisterAppUser(req, res) {
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        if(err) {
            res.writeHead(500, {'Content-Type': 'application/json'});
            console.log(JSON.stringify({error: true, databaseError: false, user: null, description: 'form-error'}));
            res.end(JSON.stringify({error: true, databaseError: false, user: null, description: 'form-error'}));
        } else {
            if(fields.email == null && fields.name == null && fields.gender == null && fields.password == null) {
                // Not Acceptable format
                res.writeHead(406, {'Content-Type': 'application/json'});
                console.log(JSON.stringify({error: true, databaseError: false, user: null, description: 'information-missing'}));
                res.end(JSON.stringify({error: true, databaseError: false, user: null, description: 'information-missing'}));
            } else {
                // Connecting to database
                MongoClient.connect(mongoUri, function(err, db) {
                    if(err) {
                        res.writeHead(500, {'Content-Type': 'application/json'});
                        console.log(JSON.stringify({error: true, databaseError: true, user: null, description: 'database-connection-error'}));
                        res.end(JSON.stringify({error: true, databaseError: true, user: null, description: 'database-connection-error'}));
                        db.close();
                    } else {
                        // TODO: Has to take HASH of password before saving
                        var collection = db.collection('users');
                        collection.insert({email: fields.email, name: fields.name, gender: fields.gender, password: fields.password}, function(err, result) {
                            if(err) {
                                res.writeHead(500, {'Content-Type': 'application/json'});
                                console.log(JSON.stringify({error: true, databaseError: true, user: null, description: 'database-find-error'}));
                                res.end(JSON.stringify({error: true, databaseError: true, user: null, description: 'database-find-error'}));
                                db.close();
                            } else {
                                if(result == null) {
                                    // user not found
                                    res.writeHead(404, {'Content-Type': 'application/json'});
                                    console.log(JSON.stringify({error: true, databaseError: false, user: null, description: 'user-nonexistent'}));
                                    res.end(JSON.stringify({error: true, databaseError: false, user: null, description: 'user-nonexistent'}));
                                    db.close();
                                } else {
                                    // User already registered
                                    res.writeHead(500, {'Content-Type': 'application/json'});
                                    console.log(JSON.stringify({error: false, databaseError: false, user: result.email, description: 'user-found'}));
                                    res.end(JSON.stringify({error: false, databaseError: false, user: result.email, description: 'user-found'}));
                                    db.close();
                                }
                            }
                        });
                    }
                });
            }
        }
    });
}

exports.checkUser = checkUser;
exports.registerAppUser = resgisterAppUser;