// Globals
const COLOR_FUNCTIONS = [ 'Slope', 'Offset', 'Power' ];
const COLOR_FLOATING_POINT = 6;
const ASC_CDL_FILETYPE_CCC = {
    node: 'ColorCorrectionCollection',
    file_ext: 'ccc',
    xmlns: 'urn:ASC:CDL:v1.2',
};
const ASC_CDL_FILETYPE_CDL = {
    node: 'ColorDecisionList',
    file_ext: 'cdl',
    xmlns: 'urn:ASC:CDL:v1.01',
};

// Lib
class CDLLib {

    parse_xml(cdl_data, source_file_name) {

        var parser = new DOMParser();
        var root = parser.parseFromString( cdl_data, 'application/xml' );
        var color_items = [];

        var ColorCorrections = root.getElementsByTagName('ColorCorrection');
        if ( ColorCorrections.length > 0 ) {
            for ( let i = 0; i < ColorCorrections.length; i++ ) {
                var color_object = new ColorCorrection( ColorCorrections[i], source_file_name );
                color_items.push( color_object );
            }
        }

        return color_items;
    }

    parse_edl(edl_data, source_file_name) {

        var color_items = [];

        if ( typeof edl_data !== 'string' ) {
            console.log('parse_edl: needs to receive string - ' + source_file_name);
            return; 
        }

        // EDL patterns
        const pattern_event = /^(?<num>\d{3,6})\s{2}(?<reel>.*?)\sV\s{5}C\s{8}(?<sourcetc_in>\d{2}:\d{2}:\d{2}:\d{2})\s(?<sourcetc_out>.*?)\s(?<rectc_in>.*?)\s(?<rectc_out>.*?)\s{2}\n(?<comments>.*)$/ms;
        const pattern_sop = /ASC_SOP\s(?<sop>\(.*?\)\(.*?\)\(.*?\))/;
        const pattern_sat = /ASC_SAT\s(?<sat>\d\.\d{1,10})/;

        // Ensure the final event is parsed also, by having sufficient newlines to match
        edl_data = edl_data + '\n\n';
        var edl_segments = edl_data.split('\n\n');

        // Test for EDL structure
        var header = edl_segments[0].split('\n');
        if ( !( header[0].slice(0, 7) == 'TITLE: ' && header[1].slice(0, 5) == 'FCM: ' ) ) {
            // Malformed EDL.
            console.log( 'malformed EDL');
            return;
        }

        var edl_events = edl_segments.slice(1, edl_segments.length);
        // Filter out blank strings
        edl_events = edl_events.filter(item => item !== '\n' && item !== '' );
        console.log( 'Events: ' + edl_events.length );

        edl_events.forEach( (event) => {
            var match = pattern_event.exec(event);
            if ( match ) {
                var comments_string = match.groups.comments;
                var match_sop = pattern_sop.exec( comments_string );
                var match_sat = pattern_sat.exec( comments_string );
                if ( match_sop && match_sat ) {
                    var sop = match_sop.groups.sop;
                    var sat = match_sat.groups.sat;
                }

                var color_item = new ColorCorrection(
                    null,
                    match.groups.reel,
                    source_file_name,
                    sop,
                    sat,
                );

                console.log( color_item );
            }
        });

    }

    export(ColorCorrections, file_ext) {
        /* Returns an XML string (single document) with all specified color items (ColorCorrection)
         * For multiple documents (aka multiple CDLs), call this function each time with the desired color items. 
         * file_ext: Supports either CCC or CDL format
         */

        var out_ColorCorrections = [];
        var out_file;

        ColorCorrections.forEach( (color_item) => {
            var out_ColorCorrection = document.createElementNS(null, 'ColorCorrection');
            var SOPNode = document.createElementNS(null, 'SOPNode');
            var SATNode = document.createElementNS(null, 'SATNode');
            out_ColorCorrection.appendChild( SOPNode );
            out_ColorCorrection.appendChild( SATNode );

            // Slope, Offset, Power
            COLOR_FUNCTIONS.forEach( (func) => {
                var func_node = document.createElementNS(null, func);
                func_node.innerHTML = color_item.get_color_instruction_value_by_name(func);
                SOPNode.appendChild(func_node);
            });
            // Saturation
            var sat = document.createElementNS(null, 'Saturation')
            sat.innerHTML = color_item.saturation;
            SATNode.appendChild(sat);

            // Add identifier (remove file extension)
            out_ColorCorrection.id = color_item.source_file_name.slice(0, -4);

            // Save
            out_ColorCorrections.push( out_ColorCorrection );
        });

        if ( file_ext == ASC_CDL_FILETYPE_CCC.file_ext ) {
            var doc = document.implementation.createDocument(ASC_CDL_FILETYPE_CCC.xmlns, 'ColorCorrectionCollection');
            doc.documentElement.setAttribute('xmlns', ASC_CDL_FILETYPE_CCC.xmlns);

            // Add our created ColorCorrection nodes
            out_ColorCorrections.forEach( (node) => {
                doc.documentElement.appendChild( node );
            });

        }
        else if ( file_ext == ASC_CDL_FILETYPE_CDL.file_ext ) {
            console.log('cdl!');
            var doc = document.implementation.createDocument(ASC_CDL_FILETYPE_CDL.xmlns, 'ColorDecisionList');
            doc.documentElement.setAttribute('xmlns', ASC_CDL_FILETYPE_CDL.xmlns);

            // Add our created ColorCorrection nodes, wrapped in ColorDecision per CDL spec
            out_ColorCorrections.forEach( (node) => {
                var ColorDecision = document.createElementNS(null, 'ColorDecision');
                ColorDecision.appendChild( node );
                doc.documentElement.appendChild( ColorDecision );
            });
        }

        // Prepare a string
        const serializer = new XMLSerializer();
        out_file = serializer.serializeToString( doc );
        // Prepend the xml declaration
        out_file = '<?xml version="1.0" encoding="UTF-8"?>\n' + out_file;
        // Strip empty namespaces
        const empty_namespace_pattern = /\sxmlns=""/gm;
        // Indent XML to maintain readability, similar to other apps that export CDLs
        out_file = format_xml_as_indented( out_file );
        out_file = out_file.replace(empty_namespace_pattern, '');
        return out_file;
        
    }

}

class ColorCorrection {

    /*
        slope = (1.0, 1.0, 1.0),
        offset = (0.0, 0.0, 0.0),
        power = (1.0, 1.0, 1.0),
    */

    constructor(
        node = false,
        identifier = false,
        source_file_name = false,
        ASC_SOP = '(1.000000 1.000000 1.000000)(0.000000 0.000000 0.000000)(1.000000 1.000000 1.000000)',
        ASC_SAT = '1.0',
    )
    {
        // Init values
        this.color = {};
        this.node = node;

        // INIT:
        // If an existing <ColorCorrection> node is provided
        if ( this.node ) {
            if ( !this.identifier ) {
                // If no identifier specified, work to get one
                if ( this.node.id.length > 0 ) {
                    this.identifier = this.node.id;
                }
                else if ( source_file_name ) {
                    // Only add filename if there are no other identifiers inside.
                    this.identifier = source_file_name;
                }
            }
            // Parse the colour values within
            var SOP = this.node.getElementsByTagName('SOPNode')[0];
            COLOR_FUNCTIONS.forEach( (color_function) => {
                var this_func_rgb = SOP.getElementsByTagName( color_function )[0].innerHTML;
                this.color[color_function] = get_float_rgb_from_string( this_func_rgb );
            });
            var SAT = this.node.getElementsByTagName('SATNode')[0].getElementsByTagName('Saturation')[0].innerHTML;
            this.color.Saturation = get_float_from_string(SAT);

        }
        // If no node is provided, and the ColorCorrection object is
        // expected to be created from user-specified values.
        else {
            // Process the values provided first
            var sop_triplet = get_triplet_float_rgb_from_string( ASC_SOP );
            this.color.Slope = sop_triplet[0];
            this.color.Offset = sop_triplet[1];
            this.color.Power = sop_triplet[2];

            this.color.Saturation = get_float_from_string( ASC_SAT );

            // Then create a node tree and fill it
            var node_cc = document.createElementNS(null, 'ColorCorrection');
            // If an identifier is provided
            if ( this.identifier ) {
                // Write it to the node
                node_cc.id = identifier;
            }

            var node_SOP = document.createElementNS(null, 'SOPNode');
            node_cc.appendChild( node_SOP );
            // For each Slope, Offset, Power
            COLOR_FUNCTIONS.forEach( (color_function) => {
                var function_node = document.createElementNS(null, color_function);
                // Write the value back out to string again
                function_node.innerHTML = get_string_from_float_rgb( this.color[color_function] );
                node_SOP.appendChild(function_node);
            });
            var node_SAT = document.createElementNS(null, 'SATNode');
            node_cc.appendChild( node_SAT );
            var node_SAT_Saturation = document.createElementNS(null, 'Saturation');
            node_SAT_Saturation.innerHTML = get_string_zero_padded_from_float( this.color.Saturation );
            node_SAT.appendChild(node_SAT_Saturation);

            // Save the node
            this.node = node_cc;

        }

        // Maintain source_file_name for any potential use, even if it is not used as the identifier
        this.source_file_name = source_file_name;

    }

    get_color_instruction_value_by_name(name) {
        if ( name == 'Slope' ) {
            return this.slope;
        }
        else if ( name == 'Offset' ) {
            return this.offset;
        }
        else if ( name == 'Power' ) {
            return this.power;
        }
        else if ( name == 'Saturation' ) {
            return this.saturation;
        }
    }

    get slope() {
        return get_string_from_float_rgb( this.color.Slope );
    }
    get offset() {
        return get_string_from_float_rgb( this.color.Offset );
    }
    get power() {
        return get_string_from_float_rgb( this.color.Power );
    }
    get saturation() {
        return get_string_zero_padded_from_float( this.color.Saturation );
    }
    get sop_as_string() {
        const format = ( c ) => `(${c['Slope']})(${c['Offset']})(${c['Power']})`;
        const c = {
            'Slope': this.color.Slope,
            'Offset': this.color.Offset,
            'Power': this.color.Power,
        };
        return format(c);
    }
    get sat_as_string() {
        const format = ( c ) => `(${c['Saturation']})`;
        const c = {
            'Saturation': this.color.Saturation,
        };
        return format(c);
    }

}

// UTILITIES

function get_triplet_float_rgb_from_string(str) {
    /* str: (1.000000 1.000000 1.000000)(0.000000 0.000000 0.000000)(1.000000 1.000000 1.000000) */
    const pattern = /\((.*?)\)\((.*?)\)\((.*?)\)/;
    var parts = pattern.exec(str);
    var triplet = [];
    for ( var i = 1; i < parts.length; i++ ) {
        // Skip first item, it is the whole string.
        triplet.push( 
            get_float_rgb_from_string( parts[i] )
        );
    }
    return triplet;
}

function get_float_from_string(str) {
    return parseFloat(str);
}

function get_float_rgb_from_string(str) {
    /* str: 1.000000 1.000000 1.000000 */
    var parts = str.split(' ');
    var values = [];
    for ( i = 0; i < str.split(' ').length; i++ ) {
        values.push( parseFloat(parts[i]) );
    }
    return [ values[0], values[1], values[2] ];
}

function get_string_zero_padded_from_float(float) {
    return Number.parseFloat(float).toFixed(COLOR_FLOATING_POINT);
}

function get_string_from_float_rgb(float_rgb) {
    var string = '';
    for ( let i = 0; i < float_rgb.length; i++ ) {
        string += get_string_zero_padded_from_float(float_rgb[i]) + ' ';
    }
    // Done, and without trailing space
    return string.slice(0, -1);
}

function format_xml_as_indented(xml, tab = '\t', nl = '\n') {
    let formatted = '', indent = '';
    const nodes = xml.slice(1, -1).split(/>\s*</);
    if (nodes[0][0] == '?') formatted += '<' + nodes.shift() + '>' + nl;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node[0] == '/') indent = indent.slice(tab.length); // decrease indent
        formatted += indent + '<' + node + '>' + nl;
        if (node[0] != '/' && node[node.length - 1] != '/' && node.indexOf('</') == -1) indent += tab; // increase indent
    }
    return formatted;
}

