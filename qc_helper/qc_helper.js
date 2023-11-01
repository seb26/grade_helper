// GLOBAL SETTINGS - USER
const APP_OCN_CLIP_LIST_IGNORE_FILE_EXTENSIONS = ['xml', 'ale', 'bin']; /* We know these are not valid clips */
const APP_DEFAULT_FPS_UNSPECIFIED = 25;
const APP_CDL_VALUES_DISPLAY_DECIMAL_PLACES = 2;

const ALE_COL_NAMES_CLIPNAME = ['Tape', 'Name', 'File Name', ]; /* In order of selection */
const ALE_COL_NAMES_TAPE = ['Tape', ];
const ALE_COL_NAMES_START_TIMECODE = ['Start', 'TC Start', 'StartTC', 'Start TC', ];
const ALE_COL_NAMES_END_TIMECODE = ['End', 'TC End', 'EndTC', 'End TC', ];
const ALE_COL_NAMES_FPS = ['FPS', 'Project FPS', 'Speed', ];
const ALE_COL_NAMES_DURATION = ['Duration', 'Clip Duration', ];

const QC_MARKERLIST_MARKER_TITLE = 'Dailies QC';
const QC_MARKERLIST_COLOUR = 'blue';
const QC_MARKERLIST_VIDEO_TRACK = 'V1';
const QC_MARKERLIST_DURATION = '1';


// CATEGORIES
const APP_REMARK = Symbol('APP_REMARK');
const APP_OCN_CLIP = Symbol('APP_OCN_CLIP');

// FORMATTING
const pluralise = (count, noun, suffix = 's') =>
  `${count} ${noun}${count !== 1 ? suffix : ''}`;

class Clip {
  constructor(clip_attribs = {
    name: undefined,
    start_tc: undefined,
    end_tc: undefined,
    fps: undefined,
    duration: undefined,
  }) {
    // Map attributes to the clip
    for (const [attr, value] of Object.entries(clip_attribs)) {
      this[attr] = value;
    }
    // Calculate duration if start & end TC are defined
    if ((!this.duration) && (this.start_tc && this.end_tc && this.fps)) {
      let fps = parseInt(this.fps);
      let start_tc = new Timecode(this.start_tc, fps);
      let end_tc = new Timecode(this.end_tc, fps);
      let duration = end_tc.subtract(start_tc);
      this.duration = duration;
    }
    // Defaults
    this.matched_remarks = [];
  }
}

class App {

  constructor() {
    this.input_files = {};
    this.input_files[APP_OCN_CLIP] = {};
    this.input_files[APP_REMARK] = {};
    this.items = {};
    this.items[APP_OCN_CLIP] = [];
    this.items[APP_REMARK] = [];

    this.flag_include_only_clips_with_remark = true;
  }
  input_file_ocn(filetype, file_data, filename) {
    var file_ext = filetype.toLowerCase();
    var file_id = uuidv4();
    // Parse content
    var parsed_rows;
    var parsed_file_object;
    if (file_ext == 'ale') {
      var parsed_file_object = alelib.parse_ale(file_data, filename);
      parsed_rows = parsed_file_object.items;
    } else if (file_ext == 'csv') {
      var parsed_file_object = Papa.parse(file_data, {
        header: true,
        skipEmptyLines: true,
      });
      parsed_rows = parsed_file_object.data;
    } else {
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
        tape: ALE_COL_NAMES_TAPE,
        start_tc: ALE_COL_NAMES_START_TIMECODE,
        end_tc: ALE_COL_NAMES_END_TIMECODE,
        fps: ALE_COL_NAMES_FPS,
        duration: ALE_COL_NAMES_DURATION,
      };
      // Search
      for (const [attr, colnames] of Object.entries(map_columns_to_values)) {
        var match_found = false;
        colnames.forEach((colname) => {
          if (entry.hasOwnProperty(colname)) {
            if (entry[colname]) {
              rough_clip[attr] = entry[colname];
              match_found = true;
            }
          }
        });
        // Fill unfound values
        if (!match_found) {
          rough_clip[attr] = '';
        }
      }
      if (!rough_clip.fps) {
        // If can't find FPS
        if (parsed_file_object instanceof ALE) {
          // get the ALE's master FPS and apply it to each clip
          rough_clip.fps = parsed_file_object.fps;
        } else {
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
    parsed_rows.forEach((entry, index) => {
      var rough_clip = get_clip_attributes_from_entry(entry);
      // Ignore these known file extensions because they are never true OCN clips
      var file_ext_from_clip_name = rough_clip.name.slice((rough_clip.name.lastIndexOf('.') - 1 >>> 0) + 2);
      if (APP_OCN_CLIP_LIST_IGNORE_FILE_EXTENSIONS.includes(file_ext_from_clip_name)) {
        user_log(
          `input_file_ocn(): Ignoring ${rough_clip.name} (known file extension).`
        );
        return;
      }
      // If for some reason this item has no Name, Start TC, End TC, FPS,
      // Then it is not truly a clip.
      if (!(rough_clip.name && rough_clip.start_tc && rough_clip.end_tc && rough_clip.fps)) {
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
  input_file_remarks(filetype, file_data, filename) {
    var fileext = filetype.toLowerCase();
    // Unique ID
    var file_id = uuidv4();
    // Parse content
    var parsed_items;
    if (fileext == 'csv') {
      function parse_csv(csv_data, source_file_name) {
        var qc_remark_items = [];
        const CSV_COL_NAMES_NAME = ['Clip Identifier', 'Name / Clip Identifier', 'Name', 'RollClip'];
        const CSV_COL_NAMES_START_TIMECODE = ['Start', 'TC Start', 'StartTC', 'Start TC', 'Timecode'];
        const CSV_COL_NAMES_COMMENT = ['Comment', ];

        function _gather_values_from_columns(array, matches) {
          for (var i = 0; i < matches.length; i++) {
            if (matches[i] in array) {
              return array[matches[i]];
            }
          }
        }
        // Parse CSV
        var csv = Papa.parse(csv_data, {
          header: true,
          skipEmptyLines: true,
        });
        var entries = [];
        csv.data.forEach((csv_line) => {
          var remark_item = {
            'metadata': []
          };
          var entry = csv_line;
          entry['_name'] = _gather_values_from_columns(csv_line, CSV_COL_NAMES_NAME);
          entry['_start_tc'] = _gather_values_from_columns(csv_line, CSV_COL_NAMES_START_TIMECODE);
          entry['_comment'] = _gather_values_from_columns(csv_line, CSV_COL_NAMES_COMMENT);
          if (entry['_start_tc'] && entry['_comment']) {
            // In grade_helper there is a complex way of setting identifiers
            // QC helper just lazy, set it once
            remark_item.identifier = entry['_name'];
            remark_item.metadata = {
              'source_file_name': source_file_name,
              'name': entry['_name'],
              'start_tc': entry['_start_tc'],
              'comment': entry['_comment'],
            };
            qc_remark_items.push(remark_item);
          } else {
            console.log('parse_csv: No Start TC or Comment information found for: ', entry['_name']);
          }
        });
        return qc_remark_items;
      }
      parsed_items = parse_csv(file_data, filename);
    } else {
      user_input_warning_trigger(
        'app_input_remarks_warning',
        `Unaccepted file type (<code>${filetype}</code>).`
      );
      return;
    }
    var count = 0;
    parsed_items.forEach((item) => {
      item.input_file_id = file_id;
      this.items[APP_REMARK].push(item);
      count += 1;
    });
    // Update the list of inputted files
    this.input_files[APP_REMARK][file_id] = {
      'id': file_id,
      'category': APP_REMARK,
      'filename': filename,
      'filetype': fileext,
      'data': file_data,
      'eventcount': count,
    };
    this.populate_filelist(APP_REMARK);
    // Clear the browser input field when done
    document.getElementById('app_input_remarks_filepicker').value = '';
  }
  populate_filelist(category) {
    if (category == APP_REMARK) {
      var items_all = this.items[APP_REMARK];
      var input_files = this.input_files[APP_REMARK];
      var display_filelist = document.getElementById('app_input_remarks_filelist');
      var display_filelist_count = document.getElementById('app_input_remarks_filelist_count');
      var display_filelist_word = 'remark';
    } else if (category == APP_OCN_CLIP) {
      var items_all = this.items[APP_OCN_CLIP];
      var input_files = this.input_files[APP_OCN_CLIP];
      var display_filelist = document.getElementById('app_input_ocn_filelist');
      var display_filelist_count = document.getElementById('app_input_ocn_filelist_count');
      var display_filelist_word = 'clip';
    } else {
      throw new Error('populate_filelist: unrecognised filelist type: ', category);
      return false;
    }
    // Clear the list to keep it current.
    display_filelist.replaceChildren();

    // Then populate.
    if (input_files) {
      var count = 0;
      for (const [id, input_file_obj] of Object.entries(input_files)) {
        var li = document.createElement('li');
        li.classList.add('filelist_item');
        var name = document.createElement('span');
        name.classList.add('filelist_item_name');
        name.textContent = input_file_obj.filename;
        var eventcount = document.createElement('span');
        eventcount.classList.add('filelist_item_eventcount');
        eventcount.textContent = '(' + pluralise(input_file_obj.eventcount, display_filelist_word) + ')';
        var btn_delete = document.createElement('a');
        btn_delete.classList.add('filelist_item_delete');
        btn_delete.dataset.file_id = input_file_obj.id;
        btn_delete.textContent = '(remove)';
        // Event handler for the delete button
        btn_delete.addEventListener('click', function() {
          this.delete_items_from_input_file(category, input_file_obj);
        }.bind(this), false);
        li.appendChild(eventcount);
        li.appendChild(btn_delete);
        li.appendChild(name);
        display_filelist.appendChild(li);
        count += 1;
      }
      display_filelist_count.textContent = ' ' + pluralise(count, 'file');
    }
  }
  populate_items_by_category(category) {
    if (category == APP_REMARK) {
      this.populate_remarks();
    } else if (category == APP_OCN_CLIP) {
      this.populate_ocn_clips();
    } else {
      return;
    }
  }
  populate_ocn_clips() {
    var tbody = document.getElementById('app_ocn_clips_tbody');
    // Clear the table on each update to keep it current
    tbody.innerHTML = '';
    // Then work.
    var count_ocn_clips_that_had_matching_remarks = 0;
    this.items[APP_OCN_CLIP].forEach((ocn_clip, clip_index) => {
      var row = tbody.insertRow(-1);
      // OCN Clip Name
      var cell_source_file_name = row.insertCell(-1);
      cell_source_file_name.textContent = ocn_clip.name;
      // OCN Clip Duration
      /* not shown in qc_helper
      var cell_duration = row.insertCell(-1);
      var dur = ocn_clip.duration;
      if ( dur.hours <= 0 ) {
        cell_duration.textContent = `${dur.minutes}m ${dur.seconds}s`;
      }
      else {
          cell_duration.textContent = dur;
      }
      */

      // OCN Clip Start TC
      var cell_start_tc = row.insertCell(-1);
      cell_start_tc.textContent = ocn_clip.start_tc;
      var cell_matched_remark_clear = row.insertCell(-1);
      var cell_matched_remark_identifier = row.insertCell(-1);
      var cell_matched_remark_start_tc = row.insertCell(-1);
      var cell_matched_remark_comment = row.insertCell(-1);
      // Fill with matched remarks
      if (ocn_clip['matched_remarks'].length > 0) {
        count_ocn_clips_that_had_matching_remarks += 1;
        // Clear button
        var btn_matched_remark_clear = document.createElement('span');
        btn_matched_remark_clear.classList.add('link-danger');
        btn_matched_remark_clear.classList.add('remark_matched_clear');
        btn_matched_remark_clear.dataset.clip_index = clip_index;
        btn_matched_remark_clear.textContent = 'x';
        // Event handler for the clear button
        btn_matched_remark_clear.addEventListener('click', function() {
          this.clear_matches_from_clip(ocn_clip, clip_index);
        }.bind(this), false);
        // Add the button
        cell_matched_remark_clear.appendChild(btn_matched_remark_clear);
        // Add in matched remark display info
        var matched_remark = ocn_clip['matched_remarks'][0];
        cell_matched_remark_identifier.textContent = matched_remark.identifier;
        cell_matched_remark_start_tc.textContent = matched_remark.metadata.start_tc ?? '';
        cell_matched_remark_comment.textContent = matched_remark.metadata.comment ?? '';
      } else {
        cell_matched_remark_identifier.textContent = '';
      }
    });
    // Update the status info
    var match_statusinfo_count_of_matched_remarks = document.getElementById('app_match_statusinfo_count_of_matched_remarks');
    match_statusinfo_count_of_matched_remarks.innerHTML = count_ocn_clips_that_had_matching_remarks + ' matching remarks';
    var ocn_clips_statusinfo = document.getElementById('app_ocn_clips_statusinfo');
    ocn_clips_statusinfo.innerHTML = pluralise(this.items[APP_OCN_CLIP].length, 'clip');
  }
  populate_remarks() {
    var tbody = document.getElementById('app_remarks_tbody');
    // Clear the table on each update to keep it current
    tbody.innerHTML = '';
    // Then work.
    this.items[APP_REMARK].forEach((remark) => {
      var row = tbody.insertRow(-1);
      var cell_remark_name = row.insertCell(-1);
      var cell_start_tc = row.insertCell(-1);
      var cell_comment = row.insertCell(-1);
      cell_remark_name.textContent = remark.metadata.name;
      cell_start_tc.textContent = remark.metadata.start_tc ?? '';
      cell_comment.textContent = remark.metadata.comment ?? '';
    });
    // Update the status info
    var remarks_statusinfo = document.getElementById('app_remarks_statusinfo');
    remarks_statusinfo.innerHTML = pluralise(this.items[APP_REMARK].length, 'remark');
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
    // Iterate and clear matched remarks on all items
    this.items[APP_OCN_CLIP].forEach((ocn_clip) => {
      ocn_clip.matched_remarks.length = 0;
    });
    // Repopulate
    this.populate_items_by_category(APP_OCN_CLIP);
  }
  clear_matches_from_clip(ocn_clip) {
    ocn_clip.matched_remarks.length = 0;
    // Repopulate
    this.populate_items_by_category(APP_OCN_CLIP);
  }
  match_remarks_to_ocn_auto() {
    this.items[APP_REMARK].forEach((remark) => {

        var match_found = false;
        while (!match_found) {
          this.items[APP_OCN_CLIP].forEach((ocn_clip) => {
              // First establish FPS
              var fps;
              if (remark.fps) {
                fps = remark.fps;
              } else if (ocn_clip.fps) {
                fps = ocn_clip.fps;
              } else {
                fps = APP_DEFAULT_FPS_UNSPECIFIED;
              }

              // 1. MATCH BY CLIP IDENTIFIER SIMILARITY
              const patterns_clipidentifier = [
                /([a-zA-Z][a-zA-Z]?\d{3,4}_?[a-zA-Z][a-zA-Z]?\d{3,4})/g, // ARRI, DJI, RED, SONY
                /([a-zA-Z]\d{3,4}_?(\d{8}\_)?[a-zA-Z]?\d{3})/g, // BLACKMAGIC
              ];
              patterns_clipidentifier.every((pattern) => {
                  var ocn_clip_name_match = ocn_clip.name.match(pattern);
                  var remark_clip_name_match = remark.identifier.match(pattern);
                  if ((ocn_clip_name_match && remark_clip_name_match)) {
                    if (ocn_clip_name_match[0] == remark_clip_name_match[0]) {
                      // OCN clipidentifier matches the remark clip identifier
                      // e.g. A001C001 is present somewhere in the remark label
                      // Therefore, found a potential match!
                      // Need to confirm it with Timecode.

                      return false;
                    }
                    // 2. AND MATCH BY TIMECODE
                    if (remark.metadata.start_tc && ocn_clip.start_tc && ocn_clip.end_tc) {
                      // Gather start & finish times
                      var ocn_clip_start_f = new Timecode(ocn_clip.start_tc, fps).frameCount();
                      var ocn_clip_end_f = new Timecode(ocn_clip.end_tc, fps).frameCount();
                      var remark_start_f = new Timecode(remark.metadata.start_tc, fps).frameCount();
                      if (remark.metadata.end_tc) {
                        var remark_end_f = new Timecode(remark.metadata.end_tc, fps).frameCount();
                      } else {
                        // If no end TC is available, substitute with start (assuming 1 frame);
                        var remark_end_f = new Timecode(remark.metadata.start_tc, fps).frameCount() + 1;
                      }
                      // Overlapping logic
                      function overlap(x1, x2, y1, y2) {
                        return (x1 <= y2 && y1 <= x2);
                      }
                      if (overlap(ocn_clip_start_f, ocn_clip_end_f, remark_start_f, remark_end_f)) {
                        // Found a match!
                        // Update its identifier
                        // Save it to the clip.
                        remark.start_tc = new Timecode(remark.metadata.start_tc, fps);
                        ocn_clip.matched_remarks.push(remark);
                        match_found = true;
                      } else {
                        // No match
                      }
                    }
                  } else {
                    // No match
                  }
                }
              });
          });
      }
    });
  this.populate_ocn_clips();
}
output_ocn_clips_to_file(file_type) {
  var output_clips = [];
  var output_remarks = [];
  var output_clips_with_remarks = [];
  var output_files = [];
  this.items[APP_OCN_CLIP].forEach((ocn_clip) => {
    // Save
    output_clips.push(ocn_clip);
    if (ocn_clip.matched_remarks.length > 0) {
      output_clips_with_remarks.push(ocn_clip);
      var remark = ocn_clip.matched_remarks[0];
      output_remarks.push(remark);
    }
  });
  // Check for "Include only clips with remark"
  if (this.flag_include_only_clips_with_remark) {
    output_clips = output_clips_with_remarks;
  }
  if (file_type == 'edl') {
    output_files.push(this.export_edl(output_clips, 'name'));
  } else if (file_type == 'edl+markerlist') {
    output_files.push(this.export_edl(output_clips, 'name'));
    output_files.push(this.export_markerlist(output_clips, 'name'));
  }
  console.log('520', output_files);
  return output_files;
}
output_remarks_to_file(file_type) {
  var output_files = []
  return output_files;
}
export_edl(clips, sort_by_attribute = false, export_events = false) {
  var edl = new EDL;
  var paired_ccc_index = 0;
  var remarks_with_paired_ccc = [];
  // Sorting alphabetically
  if (sort_by_attribute) {
    clips.sort(function(a, b) {
      var textA = a[sort_by_attribute].toUpperCase();
      var textB = b[sort_by_attribute].toUpperCase();
      return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    });
  }
  clips.forEach((clip) => {
    var edl_clip = new EDLClip(
      clip.tape,
      clip.start_tc,
      clip.end_tc,
      clip.fps,
    );
    var events = edl.add_event_to_timeline_sequentially(edl_clip);
  });
  if (export_events) {
    return edl;
  } else {
    return {
      'file_ext': 'edl',
      'data': edl.export(),
      'remarks': remarks_with_paired_ccc ?? undefined,
    };
  }
}
export_markerlist(clips) {
  // Markerlist format
  // Process an EDL but don't return a file, instead list of events
  var EDL = this.export_edl(clips, 'name', true);
  // Gather the clips that have matching remarks
  var clips_with_matching_remarks = [];
  var markerlist_table = [];
  clips.forEach((clip) => {
    if (clip.matched_remarks.length > 0) {
      clip.matched_remarks.forEach((remark) => {
        console.log('562', clip, remark);
        clips_with_matching_remarks.push([
          clip,
          remark
        ]);
      });
    }
  });
  clips_with_matching_remarks.forEach((clip) => {
    EDL.events.forEach((ev) => {
      // In order to find Record TC, match up the Remark to the EDL event
      if (ev.reel == clip[0].tape) {
        var remark_tc_rec_f = ev.record_tc_in + (clip[1].start_tc - ev.source_tc_in);
        var remark_tc_rec = new Timecode(remark_tc_rec_f, ev.fps);
        // Write to the table
        markerlist_table.push([
          QC_MARKERLIST_MARKER_TITLE,
          remark_tc_rec.toString(),
          QC_MARKERLIST_VIDEO_TRACK,
          QC_MARKERLIST_COLOUR,
          clip[1].metadata.comment,
          QC_MARKERLIST_DURATION,
        ]);
      }
    });
  });
  // Create TSV for Avid Media Composer
  var markerlist_txt = Papa.unparse(
    markerlist_table, {
      'delimiter': '\t',
      'newline': '\n',
    }
  );
  return {
    'file_ext': 'txt',
    'data': markerlist_txt,
  };

}
}

// BROWSER FILE HANDLING
function read_file_to_string(input_function, file, filename, callback) {
  user_log('Attempting to read: ' + filename);
  var filelist;
  let reader = new FileReader();
  reader.readAsBinaryString(file);
  reader.onloadend = function() {
    var file_ext = file.name.split('.').pop();
    input_function(file_ext, reader.result, file.name);
    callback();
  }
}

function read_files_multiple(input_function, files, callback) {
  for (var i = 0; i < files.length; i++) {
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
  if (contenttype == 'ocn') {
    input_function = app.input_file_ocn.bind(app);
    update_table_function = app.populate_ocn_clips.bind(app);
  } else if (contenttype == 'remarks') {
    input_function = app.input_file_remarks.bind(app);
    update_table_function = app.populate_remarks.bind(app);
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
  if (contenttype == 'remarks') {
    // Delete all
    app.delete_items_all(APP_REMARK);
  } else if (contenttype == 'ocn') {
    // Delete all
    app.delete_items_all(APP_OCN_CLIP);
  }
}

function event_remarks_match_auto(e) {
  app.match_remarks_to_ocn_auto();
}

function event_remarks_match_clear_all(e) {
  app.clear_matches_all();
}

function event_request_output_file_all(e) {
  var file_type = e.target.dataset.outputfiletype;
  var input_type = e.target.dataset.inputtype;
  if (input_type == 'clips') {
    var output_files = app.output_ocn_clips_to_file(file_type);
    var output_file_prefix = app_output_filename_ocn_clips.value;
  } else if (input_type == 'remarks') {
    var output_files = app.output_remarks_to_file(file_type);
    var output_file_prefix = app_output_filename_remarks.value;
  }
  user_log('Output files:', output_files);
  output_files.forEach((file) => {
    if (file.data) {
      file.size_bytes = file.data.length;
      file.size = format_bytes(file.size_bytes);
      file.name = output_file_prefix + '.' + file.file_ext;
      user_log('\xa0\xa0\xa0\xa0' + file.name + ' (' + file.size + ')');
      browser_output_file_as_download(file.data, file.name);
    }
  });
}

function event_flag_include_only_clips_with_remark(e) {
  // Toggle status
  app.flag_include_only_clips_with_remark = !app.flag_include_only_clips_with_remark;
}


// USER LOG
function user_log(text) {
  var log = document.getElementById('app_log_output');
  var line = document.createElement('div');
  line.textContent = format_time_as_HHMM() + ": " + text;
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
  for (var i = 0; warnings.length > i; i++) {
    user_input_warning_clear(warnings[i]);
  }
}

// FORMATTING
function format_date_as_YYYYMMDD(date = new Date()) {
  function padTo2Digits(num) {
    return num.toString().padStart(2, '0');
  }
  return [
    date.getFullYear(),
    padTo2Digits(date.getMonth() + 1),
    padTo2Digits(date.getDate()),
  ].join('');
}

function format_time_as_HHMM(date = new Date()) {
  function padTo2Digits(num) {
    return num.toString().padStart(2, '0');
  }
  return [
    padTo2Digits(date.getHours()),
    padTo2Digits(date.getMinutes()),
  ].join(':');
}

function format_bytes(bytes, decimals) {
  if (bytes == 0) return '0 Bytes';
  var k = 1024,
    dm = decimals || 2,
    sizes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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

// INPUT: remarks
const app_input_remarks_droparea = document.getElementById('app_input_remarks_droparea');
const app_input_remarks_filepicker = document.getElementById('app_input_remarks_filepicker');
const app_input_remarks_filelist_removeall = document.getElementById('app_input_remarks_filelist_removeall');
app_input_remarks_droparea.addEventListener('drop', event_read_files_dropped, false);
app_input_remarks_filepicker.addEventListener('change', event_read_files_selected, false);
app_input_remarks_filelist_removeall.addEventListener('click', event_remove_items_by_type, false);

// MATCH
const app_match_btn_match_auto = document.getElementById('app_match_btn_match_auto');
app_match_btn_match_auto.addEventListener('click', event_remarks_match_auto, false);
const app_match_btn_match_clear_all = document.getElementById('app_match_btn_match_clear_all');
app_match_btn_match_clear_all.addEventListener('click', event_remarks_match_clear_all, false);

// OUTPUTS
const app_output_btn_ocn_clips = document.getElementsByClassName('app_output_btn_ocn_clips');
for (var i = 0; app_output_btn_ocn_clips.length > i; i++) {
  app_output_btn_ocn_clips[i].addEventListener('click', event_request_output_file_all, false);
}
const app_output_flag_include_only_clips_with_remark = document.getElementById('app_output_checkbox_flag_include_only_clips_with_remark');
app_output_flag_include_only_clips_with_remark.addEventListener('change', event_flag_include_only_clips_with_remark, false);


// OUTPUT FILE PREFIX - default
const app_output_filename_ocn_clips = document.getElementById('app_output_filename_ocn_clips');
app_output_filename_ocn_clips.value = 'qc_helper_' + format_date_as_YYYYMMDD();

// EVENT HANDLERS
// Prevent default drag behaviors
;
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event_name => {
  var dropareas = document.getElementsByClassName('droparea');
  for (var i = 0; dropareas.length > i; i++) {
    dropareas[i].addEventListener(event_name, preventDefaults, false)
  }
  document.body.addEventListener(event_name, preventDefaults, false);
})

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}