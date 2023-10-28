/* Author: Sebastian Reategui */

// Globals
const COLOR_FUNCTIONS = [ 'Slope', 'Offset', 'Power' ];
const COLOR_INTERNAL_FLOATING_POINT = 6;
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

    parse_xml(cdl_data_as_xml, source_file_name) {

        var parser = new DOMParser();
        var root = parser.parseFromString( cdl_data_as_xml, 'application/xml' );
        var color_items = [];

        var ColorCorrections = root.getElementsByTagName('ColorCorrection');
        if ( ColorCorrections.length > 0 ) {
            for ( let i = 0; i < ColorCorrections.length; i++ ) {
                var color_object = new ColorCorrection(
                    ColorCorrections[i],
                    source_file_name,
                );
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
        const pattern_event = /^(?<num>\d{3,6})\s+(?<reel>.*?)\s+V\s+C\s+(?<sourcetc_in>\d{2}:\d{2}:\d{2}:\d{2})\s(?<sourcetc_out>.*?)\s(?<rectc_in>.*?)\s(?<rectc_out>.*?)(\s{2}\n(?<comments>.*))?$/gms;
        // Event lines are delineated by double line break
        const pattern_newline = /(\r\r|\n\n|\r\n\r\n)/m;
        const pattern_sop = /ASC_SOP\s(?<sop>\(.*?\)\(.*?\)\(.*?\))/;
        const pattern_sat = /ASC_SAT\s(?<sat>\d\.\d{1,10})/;

        var edl_lines = edl_data.split(pattern_newline);
        function _is_valid_line(line) {
            if ( !line || !line.trim() ) {
        		// Filter out blank strings
                return;
            }
            if ( line.startsWith('TITLE:') || line.startsWith('FCM') ) {
        		// Skip EDL header elements: TITLE, FCM
                return;
            }
            return line;
        }
        var edl_events = edl_lines.filter(_is_valid_line);
        edl_events.forEach( (event, index) => {
            var match = pattern_event.exec(event);
            if ( match ) {
                var comments_string = match.groups.comments;
                var match_sop = pattern_sop.exec( comments_string );
                var match_sat = pattern_sat.exec( comments_string );
                if ( match_sop && match_sat ) {
                    var sop = match_sop.groups.sop;
                    var sat = match_sat.groups.sat;
                }
                var metadata = {
                    'start_tc': match.groups.sourcetc_in,
                    'end_tc': match.groups.sourcetc_out,
                };
                var color_item = new ColorCorrection(
                    null,
                    source_file_name,
                    sop,
                    sat,
                    metadata,
                );
                color_item.set_identifier(match.groups.reel);
                color_items.push( color_item );
            }
            else {
                console.log(
                    `cdl.js: parse_edl(): no match for index ${index}: ${event}`
                );
            }
        });

        return color_items;
    }

    parse_csv(csv_data, source_file_name) {
        var color_items = [];
        const CSV_COL_NAMES_NAME = [ 'Clip Identifier', 'Name / Clip Identifier', ];
        const CSV_COL_NAMES_START_TIMECODE = [ 'Start', 'TC Start', 'StartTC', 'Start TC', ];
		const CSV_COL_NAMES_END_TIMECODE = [ 'End', 'TC End', 'EndTC', 'End TC', ];
		const CSV_COL_NAMES_DURATION = [ 'Duration', 'Clip Duration', ];
		const CSV_COL_NAMES_FPS = [ 'FPS', 'Project FPS', 'Speed', ];
        const CSV_COL_NAMES_SOP = [ 'CDL Nodes (SOP)', ];
        const CSV_COL_NAMES_SAT = [ 'SAT Nodes', ];
        const CSV_COL_NAMES_SCENE = [ 'Scene', ];
        const CSV_COL_NAMES_TAKE = [ 'Take', ];
        function _gather_values_from_columns(array, matches) {
            for ( var i = 0; i < matches.length; i++ ) {
                if ( matches[i] in array ) {
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
        csv.data.forEach( (csv_line) => {
            var entry = csv_line;
            entry['_name'] = _gather_values_from_columns(csv_line, CSV_COL_NAMES_NAME);
            entry['_sop'] = _gather_values_from_columns(csv_line, CSV_COL_NAMES_SOP);
            entry['_sat'] = _gather_values_from_columns(csv_line, CSV_COL_NAMES_SAT);
            // Only add colour items, for those CSV lines with actual colour data.
            if ( entry['_sop'] && entry['_sat'] ) {
                // Look for multiple lines of SOP
                var sop_split = entry['_sop'].split(/(\r|\r\n|;)/);
                // Filter out bad entries
                sop_split = sop_split.filter(item => item !== '\n' && item !== ';' && item !== '' );
                if ( sop_split.length > 1 ) {
                    // Use the first line of SOP to initiate the ColorCorrection object
                    entry['_sop'] = sop_split[0];
                    // Save one more line of SOP and add it to the ColorCorrection object later.
                    var additional_sop = sop_split[1];
                }
                var metadata = {
                    'start_tc': _gather_values_from_columns(csv_line, CSV_COL_NAMES_START_TIMECODE),
                    'end_tc': _gather_values_from_columns(csv_line, CSV_COL_NAMES_END_TIMECODE),
                    'fps': _gather_values_from_columns(csv_line, CSV_COL_NAMES_FPS),
                    'duration': _gather_values_from_columns(csv_line, CSV_COL_NAMES_DURATION),
                    'scene': _gather_values_from_columns(csv_line, CSV_COL_NAMES_SCENE),
                    'take': _gather_values_from_columns(csv_line, CSV_COL_NAMES_TAKE),
                };
                var color_item = new ColorCorrection(
                    null,
                    source_file_name,
                    entry['_sop'],
                    entry['_sat'],
                    metadata,
                );
                if ( additional_sop ) {
                    color_item.add_sop_from_string(additional_sop);
                }
                color_item.set_identifier(entry['_name']);
                color_items.push( color_item );
            }
            else {
                console.log( 'CDLLib: parse_csv: No color information found for line: ', entry['_name']);
            }
        });
        return color_items;
    }

    export(ColorCorrections, file_ext, use_ccc_identifier=false) {
        /* Returns an XML string (single document) with all specified color items (ColorCorrection)
         * For multiple documents (aka multiple CDLs), call this function each time with the desired color items. 
         * file_ext: Supports either CCC or CDL format
         */

        var out_ColorCorrections = [];
        var out_file;

        ColorCorrections.forEach( (color_item) => {
            // Clone it so any changes we make don't affect the original node saved in the app
            var exported_node = color_item.node.cloneNode(true);
            // Include CCC-specific identifier instead
            if ( use_ccc_identifier && color_item.ccc_identifier ) {
                exported_node.id = color_item.ccc_identifier;
            }
            else {
                // If an export identifier is nominated
                if ( color_item.export_identifier ) {
                    exported_node.id = color_item.export_identifier;
                }
                // Otherwise use the identifier found at origin time of this ColorCorrection
                else {
                    exported_node.id = color_item.identifier;
                }
            }
            out_ColorCorrections.push( exported_node );
        });

        if ( file_ext == ASC_CDL_FILETYPE_CCC.file_ext ) {
            // For CCC spec - create a <ColorCorrectionCollection> and place all our ColorCorrection(s) inside as direct children.
            var doc = document.implementation.createDocument(ASC_CDL_FILETYPE_CCC.xmlns, 'ColorCorrectionCollection');
            doc.documentElement.setAttribute('xmlns', ASC_CDL_FILETYPE_CCC.xmlns);

            // Add our created ColorCorrection nodes
            out_ColorCorrections.forEach( (node) => {
                // Remove xmlns declaration for <ColorCorrection> if it is present in the original
                node.removeAttribute('xmlns');
                doc.documentElement.appendChild( node );
            });

        }
        else if ( file_ext == ASC_CDL_FILETYPE_CDL.file_ext ) {
            // For CDL spec - create a <ColorDecisionList>, and wrap each <ColorCorrection> inside a <ColorDecision> first.
            var doc = document.implementation.createDocument(ASC_CDL_FILETYPE_CDL.xmlns, 'ColorDecisionList');
            doc.documentElement.setAttribute('xmlns', ASC_CDL_FILETYPE_CDL.xmlns);

            // Add our created ColorCorrection nodes, wrapped in ColorDecision per CDL spec
            out_ColorCorrections.forEach( (node) => {
                // Remove xmlns declaration for <ColorCorrection> if it is present in the original
                node.removeAttribute('xmlns');
                var ColorDecision = document.createElementNS(null, 'ColorDecision');
                ColorDecision.appendChild( node );
                doc.documentElement.appendChild( ColorDecision );
            });
        }
        else {
            throw new Error('cdl.js: export: file_ext is not specified or is an unrecognised filetype (supported: ccc, cdl)', file_ext );
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

    constructor(
        node = false,
        source_file_name = false,
        ASC_SOP = '(1.000000 1.000000 1.000000)(0.000000 0.000000 0.000000)(1.000000 1.000000 1.000000)',
        ASC_SAT = '1.0',
        metadata,
    )
    {
        // Init values
        this.color = {};
        this.node = node;
        this.identifier;
        this.export_identifier;
        if ( metadata ) {
        	// Optional metadata originating from the source file provided
            this.metadata = metadata;
        }
        else {
            this.metadata = {};
        }

        // INIT:
        // If an existing <ColorCorrection> node is provided
        if ( this.node ) {
            if ( !this.identifier ) {
                // If no identifier specified, work to get one
                if ( this.node.id.length > 0 ) {
                    this.identifier = this.node.id;
                }
                else if ( source_file_name ) {
                    // Only add filename (without ext) if there are no other identifiers inside.
                    this.identifier = source_file_name.split('.').shift();
                }
            }
            // Parse the colour values within
            var SOP = this.node.getElementsByTagName('SOPNode')[0];
            COLOR_FUNCTIONS.forEach( (color_function) => {
                var this_func_rgb = SOP.getElementsByTagName( color_function )[0].innerHTML;
                this.color[color_function] = get_float_rgb_from_string( this_func_rgb );
            });
            // Handle SATNode versus SatNode inconsistency
            var sat_node = this.node.getElementsByTagName('SATNode');
            if ( sat_node.length < 1 ) {
                var sat_node = this.node.getElementsByTagName('SatNode');
            }
            // console.log(sat_node);
            var SAT = sat_node[0].getElementsByTagName('Saturation')[0].innerHTML;
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

            this.color.Saturation = get_float_from_parenthesis_string( ASC_SAT );

            // Then create a node tree and fill it
            var node_cc = document.createElementNS(null, 'ColorCorrection');

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
    set_identifier(identifier) {
        this.identifier = identifier;
        this.node.id = identifier;
    }
    set_ccc_identifier(ccc_id) {
        this.ccc_identifier = ccc_id;
    }
    set_export_identifier(export_id) {
        this.export_identifier = export_id;
    }
    add_sop_from_string(ASC_SOP) {
        var sop_triplet = get_triplet_float_rgb_from_string(ASC_SOP);
        this.color.Slope = add_slope(this.color.Slope, sop_triplet[0]);
        this.color.Offset = add_offset(this.color.Offset, sop_triplet[1]);
        this.color.Power = add_power(this.color.Power, sop_triplet[2]);
    }
    add_sop_from_colorcorrection(obj) {
        if ( typeof obj == ColorCorrection ) {
            // Apply
            this.color.Slope = add_slope(this.color.Slope, obj.color.slope);
            this.color.Offset = add_offset(this.color.Offset, obj.color.offset);
            this.color.Power = add_power(this.color.Power, obj.color.power);
        }
        else {
            throw new Error('CDLLib: add_sop_from_colorcorrection: this is not a ColorCorrection object.');
        }
    }
    get_slope(places=false) {
        return get_string_from_float_rgb( this.color.Slope, places );
    }
    get_offset(places=false, pad_negative_values=false) {
        return get_string_from_float_rgb( this.color.Offset, places, pad_negative_values );
    }
    get_power(places=false) {
        return get_string_from_float_rgb( this.color.Power, places );
    }
    get_saturation(places=false) {
        return get_string_zero_padded_from_float( this.color.Saturation, places );
    }
    get_sop_as_string(places=false, pad_negative_values=false) {
        const format = ( c ) => `(${c['Slope']})(${c['Offset']})(${c['Power']})`;
        var c = {
            'Slope': this.get_slope(places),
            'Offset': this.get_offset(places, pad_negative_values),
            'Power': this.get_power(places),
        };
        return format(c);
    }
    get_sat_as_string(places=false) {
        const format = ( c ) => `${c['Saturation']}`;
        const c = {
            'Saturation': this.get_saturation(places),
        };
        return format(c);
    }
}

// UTILITIES - STRING TO VALUE
function get_triplet_float_rgb_from_string(str) {
    /* str: (1.000000 1.000000 1.000000)(0.000000 0.000000 0.000000)(1.000000 1.000000 1.000000) */
    const pattern = /\((.*?)\)\s?\((.*?)\)\s?\((.*?)\)/;
    var parts = pattern.exec(str);
    var triplet = [];
    if ( parts ) {
        for ( var i = 1; i < parts.length; i++ ) {
            // Skip first item, it is the whole string.
            triplet.push( 
                get_float_rgb_from_string( parts[i] )
            );
        }
    	return triplet;
    }
    else {
        console.log('CDLLib: get_triplet_float_rgb_from_string: could not work on this string:', str);
        return;
    }
}
function get_float_from_string(str) {
    return parseFloat(str);
}
function get_float_from_parenthesis_string(str) {
    const pattern = /\((.*?)\)/;
    var match = str.match(pattern);
    if ( match ) {
        return get_float_from_string(match[1]);
    }
    else {
      return get_float_from_string(str);
    }
}
function get_float_rgb_from_string(str) {
    /* str: 1.000000 1.000000 1.000000 */
    var parts = str.split(' ');
    var values = [];
    for ( i = 0; i < str.split(' ').length; i++ ) {
        values.push( parseFloat(parts[i]).toFixed(COLOR_INTERNAL_FLOATING_POINT) );
    }
    return [ values[0], values[1], values[2] ];
}

// UTILITIES - OUTPUT VALUES TO STRING
function get_string_zero_padded_from_float(float, places=false) {
    if ( !places ) {
        var num_decimal_places_to_output = COLOR_INTERNAL_FLOATING_POINT;
    }
    else {
        var num_decimal_places_to_output = places;
    }
    return Number.parseFloat(float).toFixed(num_decimal_places_to_output);
}
function get_string_from_float_rgb(float_rgb, places=false, pad_negative_values=false) {
    var string = '';
    var sign = '';
    for ( let i = 0; i < float_rgb.length; i++ ) {
        if ( pad_negative_values ) {
            if ( float_rgb[i].charAt(0) == '-' ) {
                sign = '';
            }
            else {
                sign = '+';
            }
        }
        string += sign + get_string_zero_padded_from_float(float_rgb[i], places) + ' ';
    }
    // Done, and without trailing space
    return string.slice(0, -1);
}

// UTILITIES - XML FORMATTING
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

// UTILITIES - MATH
function add_slope(slope_a, slope_b) {
    return [
        slope_a[0] * slope_b[0], 
        slope_a[1] * slope_b[1],
        slope_a[2] * slope_b[2],
    ];
}
function add_offset(offset_a, offset_b) {
    return [
        offset_a[0] + offset_b[0], 
        offset_a[1] + offset_b[1],
        offset_a[2] + offset_b[2],
    ];
}
function add_power(power_a, power_b) {
    return [
        power_a[0] * power_b[0], 
        power_a[1] * power_b[1],
        power_a[2] * power_b[2],
    ];
}
