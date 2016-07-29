var express = require('express');
var fortune = require('./lib/fortune.js');
var formidable = require('formidable');
var credentials = require('./credentials.js');
var emailService = require('./lib/email.js')(credentials);
var http = require('http');

var app = express();

// set up handle bars
var handlebars = require('express-handlebars').create({ 
    defaultLayout : 'main',
    helpers : {
        section : function(name, options) {
            if(!this._sections) this._sections = {};
            this._sections[name] = options.fn(this);
            return null;
        }
    }
});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

// set port
app.set('port', process.env.PORT || 3000);

// use domains for better error handling
app.use(function(req, res, next){
    // create a domain for this request
    var domain = require('domain').create();
    // handle errors on this domain
    domain.on('error', function(err){
        console.error('DOMAIN ERROR CAUGHT\n', err.stack);
        try {
            // failsafe shutdown in 5 seconds
            setTimeout(function(){
                console.error('Failsafe shutdown.');
                process.exit(1);
            }, 5000);

            // disconnect from the cluster
            var worker = require('cluster').worker;
            if(worker) worker.disconnect();

            // stop taking new requests
            server.close();

            try {
                // attempt to use Express error route
                next(err);
            } catch(error){
                // if Express error route failed, try
                // plain Node response
                console.error('Express error mechanism failed.\n', error.stack);
                res.statusCode = 500;
                res.setHeader('content-type', 'text/plain');
                res.end('Server error.');
            }
        } catch(error){
            console.error('Unable to send 500 response.\n', error.stack);
        }
    });

    // add the request and response objects to the domain
    domain.add(req);
    domain.add(res);

    // execute the rest of the request chain in the domain
    domain.run(next);
});

// static content
app.use(express.static(__dirname + '/public'));

// link body-parser
app.use(require('body-parser').urlencoded({ extended : true}));
// link cookie-parser
app.use(require('cookie-parser')(credentials.cookieSecret));

//link session
app.use(require('express-session')({
    resave: false,
    saveUninitialized: false,
    secret: credentials.cookieSecret
}));

switch (app.get('env')) {
    case 'development':
        // compact colorful dev logging
        app.use(require('morgan')('dev'));
        break;
    case 'production':
        // daily log rotation
        app.use(require('express-logger')({
            path: __dirname + '/log/request.log'
        }));
        break;
    default:
        break;
}

// middle ware for partial views
app.use(function(req, res, next){
    if(!res.locals.partials) {
        res.locals.partials = {};
    }
    res.locals.partials.weatherContext = getWeatherData();
    next();
});

// middleware for flash object from session to local context
app.use(function(req, res, next){
    // if there's a flash message, transfer it to the context, then clear it
    res.locals.flash = req.session.flash;
    delete req.session.flash;
    next();
});

// middleware to log cluster workers
app.use(function(req, res, next) {
    var cluster = require('cluster');
    if (cluster.isWorker) {
        console.log('Worker %d, received request', cluster.worker.id);
    }
    next();
});

// Dummy Data for weather
function getWeatherData() {
    return {
        locations : [
            {
                name : 'Portland',
                forecastUrl : 'https://www.wunderground.com/us/or/portland',
                iconUrl : 'http://icons-ak.wxug.com/i/c/k/partlycloudy.gif',
                weather : 'Overcast',
                temp : '54.1 F (12.8 C)'
            },
            {
                name : 'San Francisco',
                forecastUrl : 'https://www.wunderground.com/US/CA/San_Francisco.html',
                iconUrl : 'http://icons-ak.wxug.com/i/c/k/cloudy.gif',
                weather : 'Cloudy',
                temp : '70.1 F (16.8 C)'
            },
            {
                name : 'San Jose',
                forecastUrl : 'https://www.wunderground.com/US/CA/San_Jose.html',
                iconUrl : 'http://icons-ak.wxug.com/i/c/k/sunny.gif',
                weather : 'Overcast',
                temp : '80.1 F (18.8 C)'
            }            
        ]
    };
};

// error page
app.get('/fail', function(req, res){
    throw new Error("Threw new Error() from /fail. This is expected.")
});

// really bad error
app.get('/epic-fail', function(req, res){
    process.nextTick(function() {
        throw new Error('KAbooom bad :-0()');
    });
});

// home page
app.get('/', function(req, res) {
    res.cookie('monster', 'nom nom');
    res.render('home');
});

// home page
app.get('/jquery-test', function(req, res) {
    res.render('jquery-test');
});

// about page
app.get('/about', function(req, res) {
    var monster = req.cookies.monster;
    console.log('Cookie value for monster is: ' + monster);
    res.render('about', {fortune : fortune.getFortune()});
});

// thank-you page after newsletter sign up
app.get('/thankyou', function(req, res) {
    res.render('thankyou');
});

// newsletter form
app.get('/newsletter', function(req, res) {
    res.render('newsletter', {csrf : 'CSRF Token goes here'});
});

var VALID_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// for now, we're mocking NewsletterSignup:
function NewsletterSignup(){
}
NewsletterSignup.prototype.save = function(cb){
	cb();
};

// process newsletter form
app.post('/process', function(req, res){
	
    console.log('Form (from query string): ' + req.query.form);
    console.log('CSRF Token (from hidden form field): ' + req.body._csrf);
    console.log('Name (from visible input text): ' + req.body.name);
    console.log('Email from bisible input: ' + req.body.email);
    
    var name = req.body.name || '', email = req.body.email || '';
	// input validation
	if(!email.match(VALID_EMAIL_REGEX)) {
		if(req.xhr) return res.json({ error: 'Invalid name email address.' });
		req.session.flash = {
			type: 'danger',
			intro: 'Validation error!',
			message: 'The email address you entered was  not valid.',
		};
		return res.redirect(303, '/newsletter/archive');
	}
	new NewsletterSignup({ name: name, email: email }).save(function(err){
		if(err) {
			if(req.xhr) return res.json({ error: 'Database error.' });
			req.session.flash = {
				type: 'danger',
				intro: 'Database error!',
				message: 'There was a database error; please try again later.',
			};
			return res.redirect(303, '/newsletter/archive');
		}

		req.session.flash = {
			type: 'success',
			intro: 'Thank you!',
			message: 'You have now been signed up for the newsletter.',
		};

		if(req.xhr) return res.json({ success: true });

		return res.redirect(303, '/newsletter/archive');
	});
});

// create file upload form
app.get('/contest/vacation-photo', function(req, res){
    var now = new Date();

    res.render('contest/vacation-photo', { year : now.getFullYear(), month : now.getMonth()});
});

// process file upload
app.post('/contest/vacation-photo/:year/:month', function(req, res){
    var form = formidable.IncomingForm();
    form.parse(req, function(err, fields, files){
        if (err) {
            return res.redirect(303, '/error');
        }

        console.log('received fields:');
        console.log(fields);
        console.log('received files: ');
        console.log(files);
        res.redirect(303, '/thankyou');

    });
});

//custom 404 page
app.use(function(err, res) {
    res.status(404);

    res.render('404');
});

//custom 500 page
app.use(function(err, res, next) {
    console.error(err.stack);
    res.status(500);
    res.render('500');
});


var server;

function startServer() {
    server = http.createServer(app).listen(app.get('port'), function(){
      console.log( 'Express started in ' + app.get('env') +
        ' mode on http://localhost:' + app.get('port') +
        '; press Ctrl-C to terminate.' );
    });
}

if(require.main === module){
    // application run directly; start app server
    startServer();
} else {
    // application imported as a module via "require": export function to create server
    module.exports = startServer;
}
