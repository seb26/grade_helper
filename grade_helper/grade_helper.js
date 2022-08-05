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

// GLOBAL SETTINGS - USER
const APP_OCN_CLIP_LIST_IGNORE_FILE_EXTENSIONS = [ 'xml', 'ale', 'bin' ]; /* We know these are not valid clips */
const APP_DEFAULT_FPS_UNSPECIFIED = 25;
const APP_CDL_VALUES_DISPLAY_DECIMAL_PLACES = 2;

const ALE_COL_NAMES_CLIPNAME = [ 'Tape', 'Name', 'File Name', ]; /* In order of selection */
const ALE_COL_NAMES_START_TIMECODE = [ 'Start', 'TC Start', 'StartTC', 'Start TC', ];
const ALE_COL_NAMES_END_TIMECODE = [ 'End', 'TC End', 'EndTC', 'End TC', ];
const ALE_COL_NAMES_FPS = [ 'FPS', 'Project FPS', 'Speed', ];
const ALE_COL_NAMES_DURATION = [ 'Duration', 'Clip Duration', ];


// CATEGORIES
const APP_GRADE = Symbol('APP_GRADE');
const APP_OCN_CLIP = Symbol('APP_OCN_CLIP');

class Clip {
    constructor(clip_attribs = {
        name: undefined,
        start_tc: undefined,
        end_tc: undefined,
        fps: undefined,
        duration: undefined,
    }) {
        // Map attributes to the clip
        for ( const [attr, value] of Object.entries( clip_attribs ) ) {
            this[attr] = value;
        }
        // Calculate duration if start & end TC are defined
        if ( ( !this.duration ) && ( this.start_tc && this.end_tc && this.fps ) ) {
            let fps = parseInt(this.fps);
            let start_tc = new Timecode(this.start_tc, fps );
            let end_tc = new Timecode(this.end_tc, fps );
            let duration = end_tc.subtract(start_tc);
            this.duration = duration;
        }
        // Defaults
        this.matched_grades = [];
    }
}
class Grade {

}

class App {

    constructor() {
        this.input_files = {};
        this.input_files[APP_OCN_CLIP] = {};
        this.input_files[APP_GRADE] = {};
        this.items = {};
        this.items[APP_OCN_CLIP] = [];
        this.items[APP_GRADE] = [];
    }
    input_file_ocn(filetype, file_data, filename) {
        var file_ext = filetype.toLowerCase();
        var file_id = uuidv4();
        // Parse content
        var parsed_rows;
        var parsed_file_object;
        if ( file_ext == 'ale' ) {
            var parsed_file_object = alelib.parse_ale(file_data, filename);
            parsed_rows = parsed_file_object.items;
        }
        else if ( file_ext == 'csv' ) {
            var parsed_file_object = Papa.parse(file_data, {
                header: true,
                skipEmptyLines: true,
            });
            parsed_rows = parsed_file_object.data;
        }
        else {
            user_input_warning_trigger(
                'app_input_ocn_warning',
                `Unaccepted file type (<code>${filetype}</code>).`
            );
            return;
        }
        function get_clip_attributes_from_entry(entry) {
            var rough_clip = {};
            const map_columns_to_values = {
                name: ALE_COL_NAMES_CLIPNAME,
                start_tc: ALE_COL_NAMES_START_TIMECODE,
                end_tc: ALE_COL_NAMES_END_TIMECODE,
                fps: ALE_COL_NAMES_FPS,
                duration: ALE_COL_NAMES_DURATION,
            };
            // Search
            for ( const [attr, colnames] of Object.entries( map_columns_to_values ) ) {
                var match_found = false;
                colnames.forEach( (colname) => {
                    if ( entry.hasOwnProperty(colname) ) {
                        if ( entry[colname] ) {
                            rough_clip[attr] = entry[colname];
                            match_found = true;
                        }
                    }
                });
                // Fill unfound values
                if ( !match_found ) {
                    rough_clip[attr] = '';
                }
            }
            if ( !rough_clip.fps ) {
            	// If can't find FPS
                if ( parsed_file_object instanceof ALE ) {
            		// get the ALE's master FPS and apply it to each clip
                    rough_clip.fps = parsed_file_object.fps;
            	}
                else {
                    // Apply the default FPS
                    rough_clip.fps = APP_DEFAULT_FPS_UNSPECIFIED;
                    user_log(
                    	`input_file_ocn(): ${rough_clip.name}: no FPS value found, using the app default (${rough_clip.fps}).`
	                );
                }
            }
            return rough_clip;
        }
        var count = 0;
        parsed_rows.forEach( (entry, index) => {
            var rough_clip = get_clip_attributes_from_entry(entry);
            // Ignore these known file extensions because they are never true OCN clips
            var file_ext_from_clip_name = rough_clip.name.slice((rough_clip.name.lastIndexOf('.') - 1 >>> 0) + 2);
            if ( APP_OCN_CLIP_LIST_IGNORE_FILE_EXTENSIONS.includes(file_ext_from_clip_name) ) {
                user_log(
                    `input_file_ocn(): Ignoring ${rough_clip.name} (known file extension).`
                );
                return;
            }
        	// If for some reason this item has no Name, Start TC, End TC, FPS,
            // Then it is not truly a clip.
            if ( !( rough_clip.name && rough_clip.start_tc && rough_clip.end_tc && rough_clip.fps ) ) {
                user_log(
                    `input_file_ocn(): Could not find all valid attributes (name, start tc, end tc, fps) from this item: ${clip_rough.name} (${filename}, index ${index})`
                );
                return;
            }
            var clip_obj = new Clip(rough_clip);
            count += 1;
            // Attach ID
            clip_obj.input_file_id = file_id;
            // Otherwise save our progress.
            this.items[APP_OCN_CLIP].push(clip_obj);
        });
        // Update the list of inputted files
        this.input_files[APP_OCN_CLIP][file_id] = {
            'id': file_id,
            'category': APP_OCN_CLIP,
            'filename': filename,
            'filetype': file_ext,
            'data': file_data,
            'eventcount': count,
        };
        this.populate_filelist(APP_OCN_CLIP);
        // Clear the browser input field when done
        document.getElementById('app_input_ocn_filepicker').value = '';
    }
    input_file_grades(filetype, file_data, filename) {
		var fileext = filetype.toLowerCase();
        // Unique ID
        var file_id = uuidv4();
        // Parse content
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
            user_input_warning_trigger(
                'app_input_grades_warning',
                `Unaccepted file type (<code>${filetype}</code>).`
            );
            return;
        }
        var count = 0;
        parsed_items.forEach( (item) => {
            item.input_file_id = file_id;
            this.items[APP_GRADE].push(item);
            count += 1;
        });
        // Update the list of inputted files
        this.input_files[APP_GRADE][file_id] = {
            'id': file_id,
            'category': APP_GRADE,
            'filename': filename,
            'filetype': fileext,
            'data': file_data,
            'eventcount': count,
        };
        this.populate_filelist(APP_GRADE);
        // Clear the browser input field when done
        document.getElementById('app_input_grades_filepicker').value = '';
    }
    populate_filelist(category) {
        if ( category == APP_GRADE ) {
            var items_all = this.items[APP_GRADE];
            var input_files = this.input_files[APP_GRADE];
            var display_filelist = document.getElementById('app_input_grades_filelist');
            var display_filelist_count = document.getElementById('app_input_grades_filelist_count');
        }
        else if ( category == APP_OCN_CLIP ) {
            var items_all = this.items[APP_OCN_CLIP];
            var input_files = this.input_files[APP_OCN_CLIP];
            var display_filelist = document.getElementById('app_input_ocn_filelist');
            var display_filelist_count = document.getElementById('app_input_ocn_filelist_count');
        }
        else {
            throw new Error('populate_filelist: unrecognised filelist type: ', category);
            return false;
        }
        // Clear the list to keep it current.
        display_filelist.replaceChildren();

        // Then populate.
        if ( input_files ) {
            var count = 0;
            for ( const [id, input_file_obj] of Object.entries( input_files ) ) {
                var li = document.createElement('li');
                li.classList.add('filelist_item');
                var name = document.createElement('span');
                name.classList.add('filelist_item_name');
                name.textContent = input_file_obj.filename;
                var eventcount = document.createElement('span');
                eventcount.classList.add('filelist_item_eventcount');
                eventcount.textContent = input_file_obj.eventcount;
                var btn_delete = document.createElement('div');
                btn_delete.classList.add('btn', 'btn-outline-primary');
                btn_delete.classList.add('filelist_item_delete');
                btn_delete.dataset.file_id = input_file_obj.id;
                btn_delete.textContent = 'delete';
                // Event handler for the delete button
                btn_delete.addEventListener('click', function() {
                    this.delete_items_from_input_file(category, input_file_obj);
                }.bind(this), false);
                li.appendChild( name );
                li.appendChild( eventcount );
                li.appendChild( btn_delete );
                display_filelist.appendChild( li );
                count += 1;
            }
            display_filelist_count.textContent = count + ' file(s)';
        }
    }
    populate_items_by_category(category) {
        if ( category == APP_GRADE ) {
            this.populate_grades();
        }
        else if ( category == APP_OCN_CLIP ) {
            this.populate_ocn_clips();
        }
        else {
            return;
        }
    }
    populate_ocn_clips() {
        var tbody = document.getElementById('app_ocn_clips_tbody');
        // Clear the table on each update to keep it current
        tbody.innerHTML = '';
        // Then work.
        this.items[APP_OCN_CLIP].forEach( (ocn_clip, clip_index) => {
            var row = tbody.insertRow(-1);
            // OCN Clip Name
            var cell_source_file_name = row.insertCell(-1);
            cell_source_file_name.textContent = ocn_clip.name;
            // OCN Clip Duration
            var cell_duration = row.insertCell(-1);
            var dur = ocn_clip.duration;
            if ( dur.hours <= 0 ) {
            	cell_duration.textContent = `${dur.minutes}m ${dur.seconds}s`;
            }
            else {
                cell_duration.textContent = dur;
            }

            // OCN Clip Start TC
            var cell_start_tc = row.insertCell(-1);
            cell_start_tc.textContent = ocn_clip.start_tc;
            var cell_matched_grade_clear = row.insertCell(-1);
            var cell_matched_grade_identifier = row.insertCell(-1);
            var cell_matched_grade_scene = row.insertCell(-1);
            var cell_matched_grade_take = row.insertCell(-1);
            var cell_matched_grade_sop = row.insertCell(-1);
            var cell_matched_grade_sat = row.insertCell(-1);
            // Fill with matched grades
            if ( ocn_clip['matched_grades'].length > 0 ) {
                // Clear button
                var btn_matched_grade_clear = document.createElement('div');
                btn_matched_grade_clear.classList.add('btn', 'btn-outline-primary');
                btn_matched_grade_clear.classList.add('grade_matched_clear');
                btn_matched_grade_clear.dataset.clip_index = clip_index;
                btn_matched_grade_clear.textContent = 'x';
                // Event handler for the clear button
                btn_matched_grade_clear.addEventListener('click', function() {
                    this.clear_matches_from_clip(ocn_clip, clip_index);
                }.bind(this), false);
                // Add the button
                cell_matched_grade_clear.appendChild( btn_matched_grade_clear );
                // Add in matched grade display info
                var matched_grade = ocn_clip['matched_grades'][0];
                cell_matched_grade_identifier.textContent = matched_grade.identifier;
                cell_matched_grade_scene.textContent = matched_grade.metadata.scene ?? '';
                cell_matched_grade_take.textContent = matched_grade.metadata.take ?? '';
                cell_matched_grade_sop.textContent = matched_grade.get_sop_as_string(APP_CDL_VALUES_DISPLAY_DECIMAL_PLACES);
                cell_matched_grade_sat.textContent = matched_grade.get_sat_as_string(APP_CDL_VALUES_DISPLAY_DECIMAL_PLACES);
            }
            else {
                cell_matched_grade_identifier.textContent = '';
            }
        });
    }
    populate_grades() {
        var tbody = document.getElementById('app_grades_tbody');
        // Clear the table on each update to keep it current
        tbody.innerHTML = '';
        // Then work.
        this.items[APP_GRADE].forEach( (grade) => {
            var row = tbody.insertRow(-1);
            var cell_grade_name = row.insertCell(-1);
            var cell_start_tc = row.insertCell(-1);
            var cell_scene = row.insertCell(-1);
            var cell_take = row.insertCell(-1);
            var cell_sop = row.insertCell(-1);
            var cell_sat = row.insertCell(-1);
            cell_grade_name.textContent = grade.identifier;
            cell_start_tc.textContent = grade.metadata.start_tc ?? '';
            cell_scene.textContent = grade.metadata.scene ?? '';
            cell_take.textContent = grade.metadata.take ?? '';
            cell_sop.textContent = grade.get_sop_as_string(APP_CDL_VALUES_DISPLAY_DECIMAL_PLACES);
            cell_sat.textContent = grade.get_sat_as_string(APP_CDL_VALUES_DISPLAY_DECIMAL_PLACES);
        });
    }
    delete_items_from_input_file(category, file_object) {
        // Repopulate items that don't match the ID - aka they are removed
        this.items[category] = this.items[category].filter(
            item => item.input_file_id != file_object.id
        );
        // Clear the filelist item
        delete this.input_files[category][file_object.id];
        // Repopulate displays
        this.populate_filelist(category);
        this.populate_items_by_category(category);
    }
    delete_items_all(category) {
        this.items[category].length = 0;
        // Clear the filelist items
        this.input_files[category] = {};
        // Repopulate displays
        this.populate_filelist(category);
        this.populate_items_by_category(category);
    }
    clear_matches_all() {
        // Iterate and clear matched grades on all items
        this.items[APP_OCN_CLIP].forEach( (ocn_clip) => {
            ocn_clip.matched_grades.length = 0;
        });
        // Repopulate
        this.populate_items_by_category(APP_OCN_CLIP);
    }
    clear_matches_from_clip(ocn_clip) {
        ocn_clip.matched_grades.length = 0;
        // Repopulate
        this.populate_items_by_category(APP_OCN_CLIP);
    }
    match_grades_to_ocn_auto() {
        this.items[APP_OCN_CLIP].forEach( (ocn_clip) => {

            this.items[APP_GRADE].forEach( (grade) => {
                // First establish FPS
                var fps;
                if ( grade.fps ) {
                    fps = grade.fps;
                }
                else if ( ocn_clip.fps ) {
                    fps = ocn_clip.fps;
                }
                else {
                    fps = APP_DEFAULT_FPS_UNSPECIFIED;
                }
                var match_found = false;
                while ( !match_found ) {
                    // 1. MATCH BY TIMECODE
                    if ( grade.metadata.start_tc && ocn_clip.start_tc && ocn_clip.end_tc ) {
                        // Gather start & finish times
                        var ocn_clip_start_f = new Timecode(ocn_clip.start_tc, fps).frameCount();
                        var ocn_clip_end_f = new Timecode(ocn_clip.end_tc, fps).frameCount();
                        var grade_start_f = new Timecode(grade.metadata.start_tc, fps).frameCount();
                        if ( grade.metadata.end_tc ) {
                            var grade_end_f = new Timecode(grade.metadata.end_tc, fps).frameCount();
                        }
                        else {
                            // If no end TC is available, substitute with start (assuming 1 frame);
                            var grade_end_f = new Timecode(grade.metadata.start_tc, fps).frameCount() + 1;
                        }
                        // Overlapping logic
                        function overlap(x1, x2, y1, y2) {
                            return ( x1 <= y2 && y1 <= x2 );
                        }
                        if ( overlap( ocn_clip_start_f, ocn_clip_end_f, grade_start_f, grade_end_f ) ) {
                            // Found a match!
                            // Update its identifier
                            // Save it to the clip.
                            ocn_clip.matched_grades.push(grade);
                            match_found = true;
                        }
                        else {
                            // No match
                        }
                    }
                    // 2. MATCH BY CLIP IDENTIFIER SIMILARITY
                    const patterns_clipidentifier = [
                    	/([a-zA-Z][a-zA-Z]?\d{3,4}_?[a-zA-Z][a-zA-Z]?\d{3})/g, // ARRI, SONY, RED
                        /([a-zA-Z]\d{3,4}_?(\d{8}\_)?[a-zA-Z]?\d{3})/g, // BLACKMAGIC
                    ];
                    patterns_clipidentifier.forEach( ( pattern ) => {
                        var ocn_clip_name_match = ocn_clip.name.match(pattern);
                        var grade_clip_name_match = grade.identifier.match(pattern);
                        if ( ( ocn_clip_name_match && grade_clip_name_match ) ) {
                            if ( ocn_clip_name_match[0] == grade_clip_name_match[0] ) {
                                // Found a match!
                                // OCN clipidentifier matches the grade clip identifier
                                // e.g. A001C001 is present somewhere in the grade label
                                ocn_clip.matched_grades.push(grade);
                                match_found = true;
                            }
                        } 
                        else {
                            // No match.
                        }
                    });
                    break;
                }
            });
        });
        this.populate_ocn_clips();
    }
    output_ocn_clips_to_file(file_type) {
        var output_clips = [];
        var output_grades = [];
        var output_files = [];
        this.items[APP_OCN_CLIP].forEach( (ocn_clip) => {
            // Save
            output_clips.push(ocn_clip);
            // Gather the grades in a separate list, to be used by CCC export
            // which doesn't require any knowledge of ocn clips
            if ( ocn_clip.matched_grades.length > 0 ) {
                // Only the first grade if multiple.
                var grade = ocn_clip.matched_grades[0]; 
                // Assign the matched OCN clip name as the identifier for export.
                grade.set_export_identifier(ocn_clip.name);
            	output_grades.push(grade);
            }
        });
        if ( file_type == 'ccc' ) {
            output_files.push( this.export_ccc_cdl(output_grades, 'ccc') );
        }
        else if ( file_type == 'cdl-single' ) {
            // Output all grades into a single ColorDecisionList with multiple Corrections
            output_files.push( this.export_ccc_cdl(output_grades, 'cdl') );
        }
        else if ( file_type == 'cdl-multiple' ) {
            // Output grades into one ColorDecisionList per ColorCorrection
            output_grades.forEach( (grade) => {
                output_files.push( this.export_ccc_cdl([ grade ], 'cdl') );
            });
        }
        else if ( file_type == 'edl+ccc' ) {
            var edl = this.export_edl(output_clips, paired_ccc=true);
            output_files.push( edl );
            if ( edl.grades ) {
            	output_files.push( this.export_ccc_cdl(edl.grades, 'ccc', use_ccc_identifier=true) );
            }
        }
        else if ( file_type == 'edl' ) {
            output_files.push( this.export_edl(output_clips) );
        }
        return output_files;
    }
    output_grades_to_file(file_type) {
        var output_files = [];
        if ( file_type == 'ccc' ) {
            output_files.push( this.export_ccc_cdl(this.items[APP_GRADE], 'ccc') );
        }
        else if ( file_type == 'cdl-single' ) {
            // Output all grades into a single ColorDecisionList with multiple Corrections
            output_files.push( this.export_ccc_cdl(this.items[APP_GRADE], 'cdl') );
        }
        else if ( file_type == 'cdl-multiple' ) {
            // Output grades into one ColorDecisionList per ColorCorrection
            this.items[APP_GRADE].forEach( (grade) => {
                output_files.push( this.export_ccc_cdl([ grade ], 'cdl') );
            });
        }
        return output_files;
    }
    export_ccc_cdl(grades, file_ext, use_ccc_identifier=false) {
        var output_data = cdllib.export(
            grades,
            file_ext,
            use_ccc_identifier,
        );
        return {
            'file_ext': file_ext,
            'data': output_data,
        };
    }
    export_edl(clips, paired_ccc=false) {
        var edl = new EDL;
        var paired_ccc_index = 0;
        var grades_with_paired_ccc = [];
        if ( paired_ccc ) {
            // Then the grades need to take on a unique "cc00001" ID and the EDL reference that
            clips.forEach( (clip) => {
                var edl_clip = new EDLClip(
                    clip.name,
                    clip.start_tc,
                    clip.end_tc,
                    clip.fps,
                );
                if ( clip.matched_grades.length > 0 ) {
                    var grade = clip.matched_grades[0];
                    paired_ccc_index += 1;
                    var paired_ccc_id =`cc${String(paired_ccc_index).padStart(5, '0')}`;
                    edl_clip.ASC_CC_XML = paired_ccc_id;
                    grade.set_ccc_identifier(paired_ccc_id);
                    // Save the grades with cc id separately
                    grades_with_paired_ccc.push(grade);
                }
                edl.add_event_to_timeline_sequentially(edl_clip);
            });
        }
        else {
            clips.forEach( (clip) => {
                var edl_clip = new Clip(
                    clip.name,
                    clip.start_tc,
                    clip.end_tc,
                    clip.fps,
                );
                if ( clip.matched_grades.length > 0 ) {
                    var grade = clip.matched_grades[0];
                    edl_clip.ASC_SOP = grade.sop_as_string;
                    edl_clip.ASC_SAT = grade.sat_as_string;
                }
                edl.add_event_to_timeline_sequentially(edl_clip);
            });
        }
        return {
            'file_ext': 'edl',
            'data': edl.export(),
            'grades': grades_with_paired_ccc ?? undefined,
        };
    }
}

// BROWSER FILE HANDLING
function read_file_to_string(input_function, file, filename, callback) {
    user_log('Attempting to read: ' + filename);
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
function browser_output_file_as_download(data, filename) {
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
function event_read_files_from_user_input(e, files) {
    var input_function;
    var update_table_function;
    var contenttype = e.target.dataset.contenttype;
    if ( contenttype == 'ocn' ) {
        input_function = app.input_file_ocn.bind(app);
        update_table_function = app.populate_ocn_clips.bind(app);
    }
    else if ( contenttype == 'grades' ) {
        input_function = app.input_file_grades.bind(app);
        update_table_function = app.populate_grades.bind(app);
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
function event_remove_items_by_type(e) {
    var contenttype = e.target.dataset.contenttype;
    if ( contenttype == 'grades' ) {
        // Delete all
        app.delete_items_all(APP_GRADE);
    }
    else if ( contenttype == 'ocn' ) {
        // Delete all
        app.delete_items_all(APP_OCN_CLIP);
    }
}
function event_grades_match_auto(e) {
    app.match_grades_to_ocn_auto();
}
function event_grades_match_clear_all(e) {
    app.clear_matches_all();
}
function event_request_output_file_all(e) {
    var file_type = e.target.dataset.outputfiletype;
    var input_type = e.target.dataset.inputtype;
    if ( input_type == 'clips' ) {
        var output_files = app.output_ocn_clips_to_file(file_type);
    }
    else if ( input_type == 'grades' ) {
        var output_files = app.output_grades_to_file(file_type);
    }
    user_log('Output files:', output_files);
    output_files.forEach( (file) => {
        if ( file.data ) {
            var timestamp = Date.now();
            browser_output_file_as_download( file.data, 'your name here' + '.' + file.file_ext );
        }
    });
}

// USER LOG
function user_log(text) {
    var log = document.getElementById('app_log_output');
    var line = document.createElement('div');
    line.textContent = text;
    log.append(line);
    // And also send it to console.
    console.log(text);
    return;
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
const app_input_ocn_filelist_removeall = document.getElementById('app_input_ocn_filelist_removeall');
app_input_ocn_droparea.addEventListener('drop', event_read_files_dropped, false);
app_input_ocn_filepicker.addEventListener('change', event_read_files_selected, false);
app_input_ocn_filelist_removeall.addEventListener('click', event_remove_items_by_type, false);

// INPUT: GRADES
const app_input_grades_droparea = document.getElementById('app_input_grades_droparea');
const app_input_grades_filepicker = document.getElementById('app_input_grades_filepicker');
const app_input_grades_filelist_removeall = document.getElementById('app_input_grades_filelist_removeall');
app_input_grades_droparea.addEventListener('drop', event_read_files_dropped, false);
app_input_grades_filepicker.addEventListener('change', event_read_files_selected, false);
app_input_grades_filelist_removeall.addEventListener('click', event_remove_items_by_type, false);

// MATCH
const app_match_btn_match_auto = document.getElementById('app_match_btn_match_auto');
app_match_btn_match_auto.addEventListener('click', event_grades_match_auto, false);
const app_match_btn_match_clear_all = document.getElementById('app_match_btn_match_clear_all');
app_match_btn_match_clear_all.addEventListener('click', event_grades_match_clear_all, false);

// OUTPUTS
const app_output_btn_ocn_clips = document.getElementsByClassName('app_output_btn_ocn_clips');
for ( var i = 0; app_output_btn_ocn_clips.length > i; i++ ) {
    app_output_btn_ocn_clips[i].addEventListener('click', event_request_output_file_all, false);
}

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