// App

class App {

    constructor() {
        this.files_read = {};
        this.color_items = new ColorItemSet();
    }

    file_reader_loaded(e, files, i, filename) {
        var bin = e.target.result;
        this.files_read.push({
            'filename': filename,
            'data': bin,
        });
        // Load next file if required
        if ( i < files.length - 1 ) {
            this.file_reader_setup(files, i + 1);
        }
        // The end
        else {
            console.log('Read ' + (i + 1) + ' files.');
        }
    }

    file_reader_setup(files, i) {
        if ( files.length > 0 ) {
            var reader = new FileReader();
            reader.onload = (e) => {
                this.file_reader_loaded(e, files, i, files[i].name);
            };
            reader.readAsBinaryString(files[i]);
        }
        else {
            console.log('empty file list');
        }
    };


}

function event_add_cdls(e) {
    // Read the files
    this.file_reader_setup(app_input_cdl_filepicker.files, 0);
    if ( this.files_read.length >= 1 ) {
        // Clear the input field afterward
        app_input_cdl_filepicker.value = null;
        // Then process.
        var files_read = this.files_read;
        for (const file of files_read) {
            this.color_items.add_cdl_from_xml( file['data'], file['filename'] );
        }
    }

}

function event_add_cdls_update_list(e) {
    var x = this.color_items;
    console.log(x);
}



// App start

const app = new App();
const color_item_set = new ColorItemSet();

// Attach
const app_input_cdl_add_button = document.getElementById('app_input_cdl_add_button');
const app_input_cdl_filepicker = document.getElementById('app_input_cdl_filepicker');

app_input_cdl_add_button.addEventListener('click', event_add_cdls.bind(app), false);
app_input_cdl_filepicker.addEventListener('change', event_add_cdls_update_list.bind(app), false);


/* 
// 20220521 16:55 need to press 'Add' button twice in order to get it to work properly
// Then, otherwise trying to get it to print the list of colour items and then use the new function 


ColorCorrection.color_as_string

*/