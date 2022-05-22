class App {

    constructor() {
        this.parsed_files = {};
        this.color_item_set = new ColorItemSet();
    }

    input_file_color(file, filename) {
        // Need to identify filetype and distingusih between EDL and XML
        this.color_item_set.add_cdl_from_xml(file, filename);
    }

}

// FILE HANDLING
function read_file_to_string( file, filename ) {
    let reader = new FileReader();
    reader.readAsBinaryString( file );
    reader.onloadend = function() {
        app.input_file_color( reader.result, file.name );
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
    var items = app.color_item_set.items;
    var tbody = document.getElementById('app_input_active_cdls_tbody');
    // Clear the table on each update to keep it current
    tbody.innerHTML = '';
    items.forEach( (item) => {
        var row = tbody.insertRow(-1);
        var cell_source_file_name = row.insertCell(0);
        cell_source_file_name.innerHTML = item.source_file_name;
        var cell_sop = row.insertCell(-1);
        cell_sop.innerHTML = item.sop_as_string;
        var cell_sat = row.insertCell(-1);
        cell_sat.innerHTML = item.sat_as_string;
    });
}

function event_clear_file_list(e) {
    // Clear the browser filepicker element
    app_input_cdl_filepicker.value = '';
    // And clear our stored list of files, AND color items
    app.parsed_files = {};
    app.color_item_set = new ColorItemSet();
    // Refresh display for user
    event_update_file_list();
}

function event_request_output_file_all(e) {
    var file_ext = e.target.dataset.outputFiletype;
    var output_data = app.color_item_set.export(
        app.color_item_set.items,
        file_ext
    );
    output_file_as_download( output_data, 'your name here' + '.' + file_ext );
}

// APP
const app = new App();
const color_item_set = new ColorItemSet();

// APP INTERFACE

const app_input_cdl_filepicker = document.getElementById('app_input_cdl_filepicker');
const app_input_cdl_clear = document.getElementById('app_input_cdl_clear');
const app_input_drop_area = document.getElementById('app_input_drop_area');

const app_output_ccc = document.getElementById('app_output_ccc');
const app_output_cdl = document.getElementById('app_output_cdl');

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
app_input_cdl_filepicker.addEventListener('change', event_read_files_selected, false);
app_input_cdl_clear.addEventListener('click', event_clear_file_list, false);

app_output_ccc.addEventListener('click', event_request_output_file_all, false);
app_output_cdl.addEventListener('click', event_request_output_file_all, false);