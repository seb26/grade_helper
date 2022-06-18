/*
const EditDecisionList = require('./node_modules/edl-genius');
const Timecode = require('timecode-boss');
*/

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

// GLOBALS

ALE_COL_NAMES_START_TIMECODE = [ 'Start', 'TC Start', 'StartTC', 'Start TC', ];
ALE_COL_NAMES_END_TIMECODE = [ 'End', 'TC End', 'EndTC', 'End TC', ];
ALE_COL_NAMES_DURATION = [ 'Duration', 'Clip Duration', ];
ALE_COL_NAMES_FPS = [ 'FPS', 'Project FPS', 'Speed', ];
ALE_COL_NAMES_CLIPNAME = [ 'Tape', 'Name', ]; /* In order of selection */

DEFAULT_FPS_UNSPECIFIED = 25;

class App {

    constructor() {
        this.input_files_ocn = {};
        this.input_files_grades = {};
        this.ocn_clips = [];
        this.grades = [];
    }
    input_file_ocn(filetype, file_data, filename) {
        var fileext = filetype.toLowerCase();
        var parsed_items;
        if ( fileext == 'ale' ) {
            // Build clip objects
            var ale = alelib.parse_ale(file_data, filename);
            parsed_items = ale.items;
        }
        else if ( fileext == 'csv' ) {
            var csv = Papa.parse(file_data, {
                header: true,
                skipEmptyLines: true,
            });
            parsed_items = csv.data;
        }
        else {
            user_input_warning_trigger('app_input_ocn_warning', 'Only accepts files: .ale');
            event_clear_filelist_ocn();
            return;
        }
        var count = 0;
        parsed_items.forEach( (item) => {
            count += 1;
            // Save a space for matched grades
            item['_matched_grades'] = [];
        	// Gather common metadata per clip for easy access within this app
        	// Name
            ALE_COL_NAMES_CLIPNAME.some( (name_field) => {
                if ( name_field in item ) {
                    item['_name'] = item[name_field];
                    return true;
                }
                // Else
                item['_name'] = '';
            });
            // Start TC
            ALE_COL_NAMES_START_TIMECODE.some( (name_field) => {
                if ( name_field in item ) {
                    item['_starttc'] = item[name_field];
                    return true;
                }
                // Else
                item['_starttc'] = '';
            });
            // End TC
            ALE_COL_NAMES_END_TIMECODE.some( (name_field) => {
                if ( name_field in item ) {
                    item['_endtc'] = item[name_field];
                    return true;
                }
                // Else
                item['_endtc'] = '';
            });
            // FPS 
            ALE_COL_NAMES_FPS.some( (name_field) => {
                if ( name_field in item ) {
                    item['_fps'] = item[name_field];
                    return true;
                }
                // Else
                item['_fps'] = '';
            });
            // Duration
            ALE_COL_NAMES_DURATION.some( (name_field) => {
                if ( name_field in item ) {
                    item['_duration'] = item[name_field];
                    return true;
                }
                // Else
                item['_duration'] = '';
                // Calculate duration if start & end TC are defined
                if ( !item['_duration'] ) {
                    if ( item['_starttc'] && item['_endtc'] && item['_fps'] ) {
                        let fps = parseInt(item['_fps']);
                        let start_tc = new Timecode(item['_starttc'], fps );
                        let end_tc = new Timecode(item['_endtc'], fps );
                        let duration = end_tc.subtract(start_tc);
                        item['_duration'] = duration;
                    }
                }
            });
            // If for some reason this item has no Start TC, End TC, FPS, Duration
            // Then it is not truly a clip. Remove it.
            if ( !( item['_starttc'] && item['_endtc'] && item['_duration'] && item['_fps'] ) ) {
                return;
            }
            // Otherwise save our progress.
            this.ocn_clips.push(item);
        });
        // Update the list of inputted files
        this.input_files_ocn[filename] = {
            'filetype': fileext,
            'data': file_data,
            'eventcount': count,
        };
        populate_filelist_ocn();
        
    }
    input_file_grades(filetype, file_data, filename) {
		var fileext = filetype.toLowerCase();
        var parsed_items;
        if ( fileext == 'ccc' || fileext == 'cdl' ) {
            parsed_items = cdllib.parse_xml(file_data, filename);
        }
        else if ( fileext == 'edl' ) {
            parsed_items = cdllib.parse_edl(file_data, filename);
        }
        else if ( fileext == 'csv' ) {
            parsed_items = cdllib.parse_csv(file_data, filename);
        }
        else {
            user_input_warning_trigger('app_input_grades_warning', 'Only accepts files: .ccc, .cdl, .edl');
            event_clear_filelist_grades();
            return;
        }
        var count = 0;
        parsed_items.forEach( (item) => {
            this.grades.push(item);
            count += 1;
        });

        // Update the list of inputted files
        this.input_files_grades[filename] = {
            'filetype': fileext,
            'data': file_data,
            'eventcount': count,
        };
        populate_filelist_grades();
    }
    match_grades_to_ocn_auto() {
        this.ocn_clips.forEach( (ocn_clip) => {

            this.grades.forEach( (grade) => {
                // 1. Match by timecode
                // First establish FPS
                var fps;
                if ( grade.fps ) {
                    fps = grade.fps;
                }
                else if ( ocn_clip._fps ) {
                    fps = ocn_clip._fps;
                }
                else {
                    fps = DEFAULT_FPS_UNSPECIFIED;
                }
                // Convert to Timecode object to do comparison
                if ( grade.metadata.start_tc && ocn_clip._starttc && ocn_clip._endtc ) {
                    var grade_start_f = new Timecode(grade.metadata.start_tc, fps).frameCount();
                    var ocn_clip_start_f = new Timecode(ocn_clip._starttc, fps).frameCount();
                    var ocn_clip_end_f = new Timecode(ocn_clip._endtc, fps).frameCount();
                    // If grade TC takes place *during* clip recording start/end
                    if ( ( grade_start_f >= ocn_clip_start_f ) && ( ocn_clip_end_f >= grade_start_f ) ) {
                        // Found a match!
                        ocn_clip._matched_grades.push(grade);
                    	// console.log(ocn_clip._name, ocn_clip_start_f, ocn_clip_end_f, grade.identifier, grade_start_f);
                    }
                }
                else {
                    // Cannot match by timecode
                }
                
            });

        });
        populate_ocn_clips();
    }
}

// FILE HANDLING
function read_file_to_string(input_function, file, filename, callback) {
    var filelist;
    let reader = new FileReader();
    reader.readAsBinaryString( file );
    reader.onloadend = function() {
        var file_ext = file.name.split('.').pop();
        input_function(file_ext, reader.result, file.name);
        callback();
    }
}

function read_files_multiple(input_function, files, callback) {
    for ( var i = 0; i < files.length; i++ ) {
        read_file_to_string(input_function, files[i], files[i].name, callback);
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

// LIST POPULATION
function populate_filelist_ocn() {
    var filelist = document.getElementById('app_input_ocn_filelist');
    var filelist_count = document.getElementById('app_input_ocn_filelist_count');
    // Clear the list to keep it current.
    filelist.replaceChildren();

    // Then populate.
    if ( app.input_files_ocn ) {
        var count = 0;
        for ( var input_file in app.input_files_ocn ) {
            var li = document.createElement('li');
            li.classList.add('filelist_item');
            var name = document.createElement('span');
            name.classList.add('filelist_item_name');
            name.innerHTML = input_file;
            var eventcount = document.createElement('span');
            eventcount.classList.add('filelist_item_eventcount');
            eventcount.innerHTML = app.input_files_ocn[input_file].eventcount;
            li.appendChild( name );
            li.appendChild( eventcount );
            filelist.appendChild( li );

            count += 1;
        };
        document.getElementById('app_input_ocn_filelist_count').innerHTML = count + ' file(s)';
    }
}
function populate_filelist_grades() {
    var filelist = document.getElementById('app_input_grades_filelist');
    var filelist_count = document.getElementById('app_input_grades_filelist_count');
    // Clear the list to keep it current.
    filelist.replaceChildren();

    // Then populate.
    if ( app.input_files_grades ) {
        var count = 0;
        for ( var input_file in app.input_files_grades ) {
            var li = document.createElement('li');
            li.classList.add('filelist_item');
            var name = document.createElement('span');
            name.classList.add('filelist_item_name');
            name.innerHTML = input_file;
            var eventcount = document.createElement('span');
            eventcount.classList.add('filelist_item_eventcount');
            eventcount.innerHTML = app.input_files_grades[input_file].eventcount;
            li.appendChild( name );
            li.appendChild( eventcount );
            filelist.appendChild( li );

            count += 1;
        };
        document.getElementById('app_input_grades_filelist_count').innerHTML = count + ' file(s)';
    }
}
function populate_ocn_clips() {
    var tbody = document.getElementById('app_ocn_clips_tbody');
    // Clear the table on each update to keep it current
    tbody.innerHTML = '';

    // Then work.
    app.ocn_clips.forEach( (ocn_clip) => {
        var row = tbody.insertRow(-1);
        // OCN Clip Name
        var cell_source_file_name = row.insertCell(0);
        cell_source_file_name.textContent = ocn_clip['_name'];
        // OCN Clip Duration
        var cell_duration = row.insertCell(1);
        var dur = new Timecode(ocn_clip['_duration'], ocn_clip['_fps']);
        if ( dur.hours <= 0 ) {
        	cell_duration.textContent = `${dur.minutes}m ${dur.seconds}s`;
        }
        else {
            cell_duration.textContent = dur;
        }

        // OCN Clip Start TC
        var cell_start_tc = row.insertCell(-1);
        cell_start_tc.textContent = ocn_clip['_starttc'];
        var cell_matched_grade_identifier = row.insertCell(-1);
        var cell_matched_grade_scene = row.insertCell(-1);
        var cell_matched_grade_take = row.insertCell(-1);
        var cell_matched_grade_sop = row.insertCell(-1);
        var cell_matched_grade_sat = row.insertCell(-1);
        // Matched grades
        if ( ocn_clip['_matched_grades'].length > 0 ) {
            var matched_grade = ocn_clip['_matched_grades'][0];
            cell_matched_grade_identifier.textContent = matched_grade.identifier;
            cell_matched_grade_scene.textContent = matched_grade.metadata.scene ?? '';
            cell_matched_grade_take.textContent = matched_grade.metadata.take ?? '';
            cell_matched_grade_sop.textContent = matched_grade.sop_as_string;
            cell_matched_grade_sat.textContent = matched_grade.sat_as_string;
        }
        else {
            cell_matched_grade_identifier.textContent = '';
        }
        
    });
}
function populate_grades() {
    var tbody = document.getElementById('app_grades_tbody');
    // Clear the table on each update to keep it current
    tbody.innerHTML = '';

    // Then work.
    app.grades.forEach( (grade) => {
        var row = tbody.insertRow(-1);
        var cell_grade_name = row.insertCell(0);
        var cell_start_tc = row.insertCell(-1);
        var cell_scene = row.insertCell(-1);
        var cell_take = row.insertCell(-1);
        var cell_sop = row.insertCell(-1);
        var cell_sat = row.insertCell(-1);
        cell_grade_name.textContent = grade.identifier;
        cell_start_tc.textContent = grade.metadata.start_tc ?? '';
        cell_scene.textContent = grade.metadata.scene ?? '';
        cell_take.textContent = grade.metadata.take ?? '';
        cell_sop.textContent = grade.sop_as_string;
        cell_sat.textContent = grade.sat_as_string;
    });
}


// EVENTS
function event_read_files_from_user_input(e, files) {
    var input_function;
    var update_table_function;
    var contenttype = e.target.dataset.contenttype;
    if ( contenttype == 'ocn' ) {
        input_function = app.input_file_ocn.bind(app);
        update_table_function = populate_ocn_clips;
    }
    else if ( contenttype == 'grades' ) {
        input_function = app.input_file_grades.bind(app);
        update_table_function = populate_grades;
    }
    // Clear any previous warning
    user_input_warnings_clear_all();
    read_files_multiple(
        input_function,
        files,
        update_table_function,
    );
}
function event_read_files_dropped(e) {
    event_read_files_from_user_input(e, [...e.dataTransfer.files]);
}
function event_read_files_selected(e) {
    event_read_files_from_user_input(e, e.target.files);
}
function event_clear_filelist_ocn(e) {
    // Clear the browser filepicker element
    document.getElementById('app_input_ocn_filepicker').value = '';
    // Clear items
    app.input_files_ocn = {};
    // Refresh display
    document.getElementById('app_input_ocn_filelist').replaceChildren();
    document.getElementById('app_input_ocn_filelist_count').innerHTML = '0 files';
}
function event_clear_filelist_grades(e) {
    // Clear the browser filepicker element
    document.getElementById('app_input_grades_filepicker').value = '';
    // Clear items
    app.input_files_grades = {};
    // Refresh display
    document.getElementById('app_input_grades_filelist').replaceChildren();
    document.getElementById('app_input_grades_filelist_count').innerHTML = '0 files';
}
function event_match_auto_match_grades(e) {
    app.match_grades_to_ocn_auto();
}
function event_request_output_file_all(e) {
    var file_ext = e.target.dataset.outputFiletype;
    var output_data = cdllib.export(
        app.color_items,
        file_ext
    );
    output_file_as_download( output_data, 'your name here' + '.' + file_ext );
}

// WARNINGS
function user_input_warning_trigger(element, text) {
    var el = document.getElementById(element);
    el.style.display = 'block';
    el.innerHTML = text;
}
function user_input_warning_clear(element) {
    element.style.display = 'none';
    element.innerHTML = '';
}
function user_input_warnings_clear_all() {
    var warnings = document.getElementsByClassName('input_file_warning');
    for ( var i = 0; warnings.length > i; i++ ) {
        user_input_warning_clear( warnings[i] );
    }
}






// APP
const app = new App();
const cdllib = new CDLLib();
const alelib = new ALELib();

// APP INTERFACE
// INPUT: OCN FILE LISTS
const app_input_ocn_droparea = document.getElementById('app_input_ocn_droparea');
const app_input_ocn_filepicker = document.getElementById('app_input_ocn_filepicker');
const app_input_ocn_filelist_clearall = document.getElementById('app_input_ocn_filelist_clearall');
app_input_ocn_droparea.addEventListener('drop', event_read_files_dropped, false);
app_input_ocn_filepicker.addEventListener('change', event_read_files_selected, false);
app_input_ocn_filelist_clearall.addEventListener('click', event_clear_filelist_ocn, false);

// INPUT: GRADES
const app_input_grades_droparea = document.getElementById('app_input_grades_droparea');
const app_input_grades_filepicker = document.getElementById('app_input_grades_filepicker');
const app_input_grades_filelist_clearall = document.getElementById('app_input_grades_filelist_clearall');
app_input_grades_droparea.addEventListener('drop', event_read_files_dropped, false);
app_input_grades_filepicker.addEventListener('change', event_read_files_selected, false);
app_input_grades_filelist_clearall.addEventListener('click', event_clear_filelist_grades, false);

// MATCH
const app_match_btn_auto_match = document.getElementById('app_match_btn_auto_match');
app_match_btn_auto_match.addEventListener('click', event_match_auto_match_grades, false);

// EVENT HANDLERS
// Prevent default drag behaviors
;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event_name => {
    var dropareas = document.getElementsByClassName('droparea');
    for ( var i = 0; dropareas.length > i; i++ ) {
        dropareas[i].addEventListener(event_name, preventDefaults, false)
    }
    document.body.addEventListener(event_name, preventDefaults, false);
})

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}