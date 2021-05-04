/**
 * SAVE STRING CONTENT TO GOOGLE DRIVE FILE IN ROOT FOLDER
 * @param {String} filename File name including the file extension eg: test.json
 * @param {String} content String contant to be saved.
 */
function saveStringToFile(filename, stringContent) {
	try {
		var files = DriveApp.getFilesByName(filename);
		if (files.hasNext()) files.next().setContent(stringContent);
		else newFile = DriveApp.createFile(filename, stringContent); //Create a new text file in the root folder

		return 'Data saved successfully to Google Drive file: ' + filename;
	} catch (e) {
		return e.message;
	}
}

/**
 * SAVE STRING CONTENT TO FOLDER AND FILE
 * @param {String} folderName - Name of the folder
 * @param {String} filename - File name string with file extension
 * @param {String} stringContent - String content of the file
 */
function saveStringToFolder(folderName, filename, stringContent) {
	try {
		var folders = DriveApp.getFoldersByName(folderName);
		var folder = null;

		//Check if the folder already exists and else create the folder at the root
		if (folders.hasNext()) folder = folders.next();
		else folder = DriveApp.createFolder(folderName);

		//Check if the file already exists in the folder else create the file
		var files = folder.getFilesByName(filename);
		if (files.hasNext()) files.next().setContent(stringContent);
		else newFile = folder.createFile(filename, stringContent);

		return `Data saved successfully to GDrive: ${folder.getName()}/${filename}`;
	} catch (e) {
		return e.message;
	}
}

/**
 * READ DATA FROM FILE AND RETURN AS STRING
 * @param {String} filename Name of the file to extract the text.
 */
function readStringFromFile(filename) {
	try {
		let files = DriveApp.getFilesByName(filename);
		let contentText = JSON.stringify({ error: 'File not found' });
		if (files.hasNext()) contentText = files.next().getBlob().getDataAsString();
		return contentText;
	} catch (e) {
		return { error: e.message };
	}
}
