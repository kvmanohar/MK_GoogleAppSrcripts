function include(fileName) {
	return HtmlService.createHtmlOutputFromFile(fileName).setTitle("Endeavour - Dependency View").getContent();
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

//Read content of the Google Drive by passing fileName.
function readTokenFile(fileName) {
	var contentArray = [];
	var files = DriveApp.getFilesByName(fileName);
	if (files.hasNext()) {
		let contentText = files.next().getBlob().getDataAsString();
		contentArray = contentText.split('\n');
	}

	return contentArray;
}

function updateTokenFile(jiraDetails) {
	let content = jiraDetails[0] + '\n' + jiraDetails[1];

	try {
		var files = DriveApp.getFilesByName(jiraTokenFileName);
		if (files.hasNext()) files.next().setContent(content);
        else newFile = DriveApp.createFile(jiraTokenFileName,content);  //Create a new text file in the root folder      
        
      return 'Settings Updated successfully';
      
	} catch (e) {
		return e.message;
	}
}

function saveDataToDrive(filename, content){
	try {
		var files = DriveApp.getFilesByName(filename);
		if (files.hasNext()) files.next().setContent(content);
        else newFile = DriveApp.createFile(filename,content);  //Create a new text file in the root folder      
        
      return 'Data saved successfully to Google Drive file: ' + filename;
      
	} catch (e) {
		return e.message;
	}
}

function readDataFromDrive(filename){
  try{
	let files = DriveApp.getFilesByName(filename);
    let contentText = "";
	if (files.hasNext())  contentText = files.next().getBlob().getDataAsString();
	return contentText;  
  }
  catch(e){
    return e.message;
  }
}