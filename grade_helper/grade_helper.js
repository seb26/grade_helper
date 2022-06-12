const EditDecisionList = require('./node_modules/edl-genius');
const Timecode = require('timecode-boss');

/*
pseudocode logic

- add OCN clip information
	camera ALE, yoyotta ALE, yoyotta CSV, resolve ALE

- add grades
	CDL files (multiple), livegrade CSV

- now we have:
> list of clips
> list of grades

- [auto match grades]
	for each grade:
		for each OCN clip:
			// Match by timecode
			if ( OCN_start < grade_start < OCN_end ):
				//match!

			else:
				// Match by name
				search = grade_clipidentifier.slice(0, 8); // First 8 characters
				if ( search in OCN_clip.filename )
					//match!


- [user match grades]
	javascript bootstrap popup
*/

class App {

    constructor() {
        this.input_files_ocn = {};
        this.input_files_grades = {};
        this.ocn_clips = [];
        this.grades = [];
    }

    input_file_ocn(filetype, file_data, filename) {

    }

    input_file_grade(filetype, file_data, filename) {
        var parsed_items;
        if ( filetype == 'ccc' || filetype == 'cdl' ) {
            parsed_items = cdllib.parse_xml(file_data, filename);
        }
        else if ( filetype == 'edl' ) {
            parsed_items = cdllib.parse_edl(file_data, filename);
        }
        parsed_items.forEach( (item) => {
            this.grades.push(item);
        });
    }



}

// FILE HANDLING
function read_file_to_string(contentType, file, filename) {
    var input_file;
    var filelist;
    if ( contentType == 'ocn' ) {
        input_file = app.input_file_ocn;
        populate_filelist = event_populate_filelist_ocn;
    } 
    else if ( contentType == 'grades' ) {
        input_file = app.input_file_grade;
        populate_filelist = event_populate_filelist_grades;
    }
    let reader = new FileReader();
    reader.readAsBinaryString( file );
    reader.onloadend = function() {
        var file_ext = file.name.split('.').pop();
        input_file( file_ext, reader.result, file.name );
        populate_filelist();
    }
}

function read_files_multiple(contentType, files) {
    for ( var i = 0; i < files.length; i++ ) {
        var file = files[i];
        read_file_to_string(file, file.name);
    }
}

function output_file_as_download(data, filename) {
    // Invisible link
    var download = document.createElement('a');
    download.setAttribute(
        'href',
        'data:text/plain;charset=utf+8,' + encodeURIComponent(data)
    );
    download.setAttribute('download', filename);
    download.style.display = 'none';

    // Commence download
    document.body.appendChild(download);
    download.click();
    document.body.removeChild(download);
}



// EVENTS
function event_read_files_dropped(e) {
    var files = [...e.dataTransfer.files];
    read_files_multiple(e.target.dataset.contentType, files);
}

function event_read_files_selected(e) {
    var files = e.target.files;
    read_files_multiple(e.target.dataset.contentType, files);
}

function event_populate_filelist_ocn() {
    var filelist = document.getElementById('app_input_ocn_filelist');
    var filelist_count = document.getElementById('app_input_ocn_filelist_count');
    // Clear the list to keep it current.
    filelist.children = [];

    // Then populate.
    filelist_count.innerHTML = app.input_files_ocn.length + ' files(s)';
    if ( app.input_files_ocn.length > 0 ) {
        app.input_files_ocn.forEach( (input_file) => {
            var li = document.createElement('li').class('filelist_item');
            var name = document.createElement('span').class('filelist_item_name');
            name.innerHTML = input_file.filename;
            var eventnum = document.createElement('span').class('filelist_item_eventnum');
            eventnum.innerHTML = input_file.eventnum;
            li.appendChild( name );
            li.appendChild( eventnum );
            filelist.appendChild( li );
        });
    }
}

function event_populate_filelist_grades() {
    var filelist = document.getElementById('app_input_grades_filelist');
    var filelist_count = document.getElementById('app_input_grades_filelist_count');
    // Clear the list to keep it current.
    filelist.children = [];

    // Then populate.
    filelist_count.innerHTML = app.input_files_grades.length + ' files(s)';
    if ( app.input_files_grades.length > 0 ) {
        app.input_files_grades.forEach( (input_file) => {
            var li = document.createElement('li').class('filelist_item');
            var name = document.createElement('span').class('filelist_item_name');
            name.innerHTML = input_file.filename;
            var eventnum = document.createElement('span').class('filelist_item_eventnum');
            eventnum.innerHTML = input_file.eventnum;
            li.appendChild( name );
            li.appendChild( eventnum );
            filelist.appendChild( li );
        });
    }
}

/*
function event_populate_filelist_ocn() {
    var items = app.color_items;
    var tbody = document.getElementById('app_input_active_cdls_tbody');
    // Clear the table on each update to keep it current
    tbody.innerHTML = '';

    // Then work.
    event_update_file_count();
    items.forEach( (item) => {
        var row = tbody.insertRow(-1);
        var cell_source_file_name = row.insertCell(0);
        cell_source_file_name.innerHTML = item.source_file_name;
        var cell_identifier = row.insertCell(1);
        cell_identifier.innerHTML = item.identifier;
        var cell_sop = row.insertCell(-1);
        cell_sop.innerHTML = item.sop_as_string;
        var cell_sat = row.insertCell(-1);
        cell_sat.innerHTML = item.sat_as_string;
    });
}
*/


function event_clear_filelist(e) {
    if ( e.target.dataset.contentType == 'ocn' ) {
        // Clear the browser filepicker element
        document.getElementById('app_input_grades_filepicker') = '';
        // Clear items
        app.input_files_ocn = {};
        // Refresh display
        event_populate_filelist_ocn();
    }
    else if ( e.target.dataset.contentType == 'grades' ) {
        // Clear the browser filepicker element
        document.getElementById('app_input_grades_filepicker') = '';
        // Clear items
        app.input_files_grades = {};
        // Refresh display
        event_populate_filelist_grades();
    }
}

function event_request_output_file_all(e) {
    var file_ext = e.target.dataset.outputFiletype;
    var output_data = cdllib.export(
        app.color_items,
        file_ext
    );
    output_file_as_download( output_data, 'your name here' + '.' + file_ext );
}

// APP
const app = new App();
const cdllib = new CDLLib();

// APP INTERFACE
// INPUT: OCN FILE LISTS
const app_input_ocn_droparea = document.getElementById('app_input_ocn_droparea');
const app_input_ocn_filepicker = document.getElementById('app_input_ocn_filepicker');
const app_input_ocn_filelist_clearall = document.getElementById('app_input_ocn_filelist_clearall');
app_input_ocn_droparea.addEventListener('drop', event_read_files_dropped, false);
app_input_ocn_filepicker.addEventListener('change', event_read_files_selected, false);
app_input_ocn_filelist_clearall.addEventListener('click', event_clear_filelist, false);

// INPUT: GRADES
const app_input_grades_droparea = document.getElementById('app_input_grades_droparea');
const app_input_grades_filepicker = document.getElementById('app_input_grades_filepicker');
const app_input_grades_filelist_clearall = document.getElementById('app_input_grades_filelist_clearall');
app_input_grades_droparea.addEventListener('drop', event_read_files_dropped, false);
app_input_grades_filepicker.addEventListener('change', event_read_files_selected, false);
app_input_grades_filelist_clearall.addEventListener('click', event_clear_filelist, false);

const app_output_ccc = document.getElementById('app_output_ccc');
const app_output_cdl = document.getElementById('app_output_cdl');
app_output_ccc.addEventListener('click', event_request_output_file_all, false);
app_output_cdl.addEventListener('click', event_request_output_file_all, false);


// EVENT HANDLERS
// Prevent default drag behaviors
;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event_name => {
    var dropareas = document.getElementsByClass('droparea');
    dropareas.forEach( (entity) => {
        entity.addEventListener(event_name, preventDefaults, false);
    });
    document.body.addEventListener(event_name, preventDefaults, false);
})

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}
