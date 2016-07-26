var express = require('express');
var fortune = require('./lib/fortune.js');

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

// static content
app.use(express.static(__dirname + '/public'));

app.use(require('body-parser').urlencoded({ extended : true}));

// middle ware for partial views
app.use(function(req, res, next){
    if(!res.locals.partials) {
        res.locals.partials = {};
    }
    res.locals.partials.weatherContext = getWeatherData();
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

// home page
app.get('/', function(req, res) {
    res.render('home');
});

// home page
app.get('/jquery-test', function(req, res) {
    res.render('jquery-test');
});

// about page
app.get('/about', function(req, res) {
    res.render('about', {fortune : fortune.getFortune()});
});

app.get('/thankyou', function(req, res) {
    res.render('thankyou');
});

app.get('/newsletter', function(req, res) {
    res.render('newsletter', {csrf : 'CSRF Token goes here'});
});

app.post('/process', function(req, res){
    if (req.xhr || req.accepts('json,html') === 'json') {
        res.send({success : true});
    }
    else {
        res.redirect(303, '/thankyou');
    }
    
    console.log('Form (from query string): ' + req.query.form);
    console.log('CSRF Token (from hidden form field): ' + req.body._csrf);
    console.log('Name (from visible input text): ' + req.body.name);
    console.log('Email from bisible input: ' + req.body.email);

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

app.listen(app.get('port'), function() {
    console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate');
});