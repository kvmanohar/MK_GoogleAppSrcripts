// https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app#fetch(String,Object)

function jiraAddAttachment_() {
	var wsJiraFields = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Home');
//	var cellProgressMsg = wsJiraFields.getRange('fieldsDataUpdatedOn');

	let apiDetails = createApiDetails();
	var jiraBaseUrl = apiDetails.baseUrl;
    var header = {}
    header['Authorization'] = apiDetails.htmlHeader['Authorization'];
    header["X-Atlassian-Token"] = "no-check";
  
    var issueKey = 'TP-90';
	var url = jiraBaseUrl + '/rest/api/3/issue/' + issueKey +'/attachments';
   
    var textBlob = readFileFromDrive_('test.pdf'); 
  
    var formData = {
      'type': 'attachment',
      'fileName':'test.pdf',
      'contentType':'application/binary',
      'file': textBlob
    } 
	var options = {
      muteHttpExceptions: true,
      headers: header,
      method: 'POST',
      payload: formData
	};

	var response = UrlFetchApp.fetch(url, options);
	var json = response.getContentText();  
	var data = JSON.parse(json);
    Logger.log(data);
  
}

// Returns File content in blob format
function readFileFromDrive_(filename){
	try {
		var files = DriveApp.getFilesByName(filename);
        if (files.hasNext()){
         var fileContent = files.next().getBlob();
         return fileContent
        } else {
         return null;
        }
	} catch (e) {
          return {error: e.message};
	}
}
