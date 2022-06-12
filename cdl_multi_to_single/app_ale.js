class App {

    constructor() {
        this.this_ale;
    }

    input_file(filetype, file_data, filename) {
        var input_ale;
        if ( filetype.toLowerCase() == 'ale' ) {
            input_ale = alelib.parse_ale(file_data, filename);
        }
        this.this_ale = input_ale;
    }

}

// FILE HANDLING
function read_file_to_string( file, filename ) {
    let reader = new FileReader();
    reader.readAsBinaryString( file );
    reader.onloadend = function() {
        var file_ext = file.name.split('.').pop();
        app.input_file( file_ext, reader.result, file.name );
        event_update_file_list();
    }
}

function read_files_multiple(files) {
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
    read_files_multiple(files);
}

function event_read_files_selected(e) {
    var files = e.target.files;
    read_files_multiple(files);
}

function event_update_file_list(e) {
    var thead = document.getElementById('app_input_clips_thead');
    var tbody = document.getElementById('app_input_clips_tbody');
    // Clear the table on each update to keep it current
    thead.innerHTML = '';
    tbody.innerHTML = '';

    // Then work.
    event_update_clips_count();
    // Insert headers.
    var header_row = thead.insertRow(0);
    app.this_ale.columns.forEach( (column) => {
        var header_row_col = document.createElement('th');
        header_row_col.setAttribute('scope', 'col');
        header_row_col.innerHTML = column;
        header_row.appendChild(header_row_col);
    });
    // Insert clip rows.
    var clips = app.this_ale.items;
    clips.forEach( (clip) => {
        var row = tbody.insertRow(-1);
        app.this_ale.columns.forEach( (column) => {
            row.insertCell(-1).innerHTML = clip[column];
        });
    });
}

function event_update_clips_count(e) {
    app_input_file_count.innerHTML = app.this_ale.items.length + ' item(s)';
}

function event_clear_file_list(e) {
    // Clear the browser filepicker element
    app_input_filepicker.value = '';
    // And clear our stored list of files, AND color items
    app.this_ale = null;
    // Refresh display for user
    event_update_file_list();
}

// APP
const app = new App();
const alelib = new ALELib();

// APP INTERFACE

const app_input_filepicker = document.getElementById('app_input_filepicker');
const app_input_file_count = document.getElementById('app_input_file_count');
const app_input_clear = document.getElementById('app_input_clear');
const app_input_drop_area = document.getElementById('app_input_drop_area');

// EVENT HANDLERS
// Prevent default drag behaviors
;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event_name => {
    app_input_drop_area.addEventListener(event_name, preventDefaults, false)   
    document.body.addEventListener(event_name, preventDefaults, false)
})

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

app_input_drop_area.addEventListener('drop', event_read_files_dropped, false);
app_input_filepicker.addEventListener('change', event_read_files_selected, false);
app_input_clear.addEventListener('click', event_clear_file_list, false);