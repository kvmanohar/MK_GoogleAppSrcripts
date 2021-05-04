//Create a Route object
var Route = {};
Route.path = function (route, callback) {
  Route[route] = callback;
};

//Initial doGet function that Google Web App always calls.
function doGet(e) {
  Route.path('grid', loadGrid);
  Route.path('about', loadAbout);

  if (Route[e.parameters.v]) {
    return Route[e.parameters.v]();
  } else {
    return render('Home', { title: 'AgGrid - Sample' });
  }
}

function loadGrid() {
  return render('Grid', { title: 'AG Grid' });
}

function loadAbout() {
  return render('About', { title: 'About Us', bodyText: 'Some text here' });
}

function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).setTitle("Ag Grid - WebApp").getContent();
}

//Render function used in Code.gs
function render(file, argsObject) {
  var temp = HtmlService.createTemplateFromFile(file);
  if (argsObject) {
    var keys = Object.keys(argsObject);
    keys.forEach(function (key) {
      temp[key] = argsObject[key];
    });
  }
  return temp.evaluate();
}