/* Author: Sebastian Reategui */

/* GLOBALS */
const ALELIB_DEFAULTS = {
    VIDEO_FORMAT: 'CUSTOM',
    AUDIO_FORMAT: '48khz',
    FPS: '24',
}

class ALELib {

    parse_ale(file_data, source_file_name=false) {

        /* file_data: string - .ALE file read into string 
         * source_file_name: string - Maintain the source file name for potential use.
         */
        if ( typeof file_data !== 'string' ) {
            console.log('ALELib: parse_ale: needs to receive string for: ' + source_file_name);
            return; 
        }
        const pattern_section_separator = /^(Heading|Column|Data)[\r\n]+/m;
        const pattern_newline = /[\r\n]/;
        const pattern_delimiter = /\t/;

        // Split ALE data into sections by - Heading, Column, Data
        var data_section_raw = file_data.split(pattern_section_separator);
        var data_section = [];
        data_section_raw.forEach( (line) => {
            if ( line ) {
            	data_section.push( line.trim() );
            }
        });

        // Heading
        var metadata = {};
        if ( data_section[0] == 'Heading' ) {
            var heading_lines = data_section[1].split(pattern_newline);
            if( !heading_lines[1] == 'FIELD_DELIM\tTABS' ) {
                console.log('ERROR - ALELib: parse_ale: unrecognised FIELD_DELIM value. Only TABS is recognised.');
            }
            heading_lines.forEach( ( line ) => {
                if ( !line || line == '' ) {
                    return;
                }
                var [k, v] = line.split(pattern_delimiter);
                metadata[k] = v;
            });
        }
        else {
            console.log('ERROR - ALELib: parse_ale: unable to parse this file, it does not start with "Heading" - confirm it is truly an ALE file?', source_file_name);
        }

        // Columns
        if ( data_section[2] == 'Column' ) {
            // Split by delimiter and trim empty fields at the end.
            var columns = data_section[3].trim().split(pattern_delimiter);
            columns = columns.filter(item => item !== '\n' && item !== '');
        }
        else {
            console.log('ERROR - ALELib: parse_ale: unable to parse columns.');
        }
        
        // Data
        var table_data = [];
        if ( data_section[4] == 'Data' ) {
            var data_rows = data_section[5].trim().split(pattern_newline);
            data_rows = data_rows.filter(item => item !== '\n' && item !== '');
            // Zip the Columns with each Row
            data_rows.forEach( ( row_string ) => {
                var rows = row_string.split(pattern_delimiter);
                var row = Object.fromEntries( 
                    columns.map( ( k, i ) => [ k, rows[i] ] )
                );
                table_data.push( row );
            });
        }
        else {
            console.log('ERROR - ALELib: parse_ale: unable to parse data fields.');
        }

        // Save the object.
        var this_ale = new ALE(
            metadata.VIDEO_FORMAT,
            metadata.AUDIO_FORMAT,
            metadata.FPS,
            table_data,
            file_data,
        );
        console.log(this_ale);
        return this_ale;
    }
}

class ALE {

    constructor(
        video_format,
        audio_format,
        fps,
        table_data,
        original_file_data,
    )
    {
        this.video_format = video_format;
        this.audio_format = audio_format
        // Convert to integer
        this.fps = parseInt(fps);
        this.items = table_data;
        this.original_file_data = original_file_data;
    }

    get columns() {
        return Object.keys( this.items[0] );
    }

}