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
class ColorItemSet {

    constructor(cdl_string) {
        this._color_items = [];
    }

    add_cdl_from_xml(cdl_data, source_file_name) {

        var parser = new DOMParser();
        var root = parser.parseFromString( cdl_data, 'application/xml' );

        var ColorCorrections = root.getElementsByTagName('ColorCorrection');
        if ( ColorCorrections.length > 0 ) {
            for ( let i = 0; i < ColorCorrections.length; i++ ) {
                var color_object = new ColorCorrection( ColorCorrections[i], source_file_name );
                this._color_items.push( color_object );
            }
        }
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

    get items() {
        return this._color_items;
    }

}

class ColorCorrection {

    constructor(node, source_file_name) {
        this.node = node;

        // Identifiers
        this.identifiers = [];
        this.source_file_name = source_file_name;

        // Colour defaults
        this.color_instruction = {
            'Slope': (1.0, 1.0, 1.0),
            'Offset': (0.0, 0.0, 0.0),
            'Power': (1.0, 1.0, 1.0),
            'Saturation': 1.0,
        };

        // Potential sources for an identifier
        if ( this.node.id.length > 0 ) {
            this.identifiers.push( this.node.id );
        }
        if ( this.node.getElementsByTagName('Description').length > 0 ) {
            this.identifiers.push( this.node.getElementsByTagName('Description')[0].innerHTML );
        }
        // Only add filename if there are no other identifiers inside.
        if ( this._identifiers = 0 ) {
            this.identifiers.push( source_file_name )
        }

        // Begin parsing the SOP node
        // Expects space-separated float values representing RGB
        // e.g. "1.00000 1.00000 1.00000"
        var SOP = this.node.getElementsByTagName('SOPNode')[0];
        for ( let i = 0; i < COLOR_FUNCTIONS.length; i++ ) {
            var r_g_b = SOP.getElementsByTagName( COLOR_FUNCTIONS[i] )[0].innerHTML;
            this.color_instruction[ COLOR_FUNCTIONS[i] ] = get_float_rgb_from_string( r_g_b );
        }
        // Then SAT
        var SAT = this.node.getElementsByTagName('SATNode')[0].getElementsByTagName('Saturation')[0].innerHTML;
        this.color_instruction['Saturation'] = parseFloat(SAT);

    }

    get_color_instruction_value_by_name(function_name) {
        if ( function_name == 'Slope' ) {
            return this.slope;
        }
        else if ( function_name == 'Offset' ) {
            return this.offset;
        }
        else if ( function_name == 'Power' ) {
            return this.power;
        }
        else if ( function_name == 'Saturation' ) {
            return this.saturation;
        }
    }

    get identifier() {
        return this.identifiers[0];
    }

    get slope() {
        return get_string_from_float_rgb( this.color_instruction['Slope'] );
    }
    get offset() {
        return get_string_from_float_rgb( this.color_instruction['Offset'] );
    }
    get power() {
        return get_string_from_float_rgb( this.color_instruction['Power'] );
    }
    get saturation() {
        return get_string_zero_padded_from_float( this.color_instruction['Saturation'] );
    }
    get sop_as_string() {
        const format = ( c ) => `(${c['Slope']})(${c['Offset']})(${c['Power']})`;
        const c = {
            'Slope': this.slope,
            'Offset': this.offset,
            'Power': this.power,
        };
        return format(c);
    }
    get sat_as_string() {
        const format = ( c ) => `(${c['Saturation']})`;
        const c = {
            'Saturation': this.saturation,
        };
        return format(c);
    }


}

// UTILITIES

function get_float_rgb_from_string(str) {
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

// Samples
var cdl_sample_files = [
    `<?xml version="1.0" encoding="UTF-8"?>
    <ColorDecisionList xmlns="urn:ASC:CDL:v1.01">
        <ColorDecision>
            <ColorCorrection>
                <SOPNode>
                    <Description>seb_bimok_apple_bnw_tinted</Description>
                    <Slope>1.00000 1.00000 1.00000</Slope>
                    <Offset>0.00000 0.00000 0.00000</Offset>
                    <Power>1.00000 1.00000 1.00000</Power>
                </SOPNode>
                <SATNode>
                    <Saturation>1.00000</Saturation>
                </SATNode>
            </ColorCorrection>
        </ColorDecision>
    </ColorDecisionList>`,
    `<?xml version="1.0" ?>
    <ColorCorrectionCollection xmlns="urn:ASC:CDL:v1.2">
        <ColorCorrection id="B001C001_220507_R6VL">
            <SOPNode>
                <Slope>1.000000 1.000000 1.000000</Slope>
                <Offset>0.000000 0.000000 0.000000</Offset>
                <Power>1.000000 1.000000 1.000000</Power>
            </SOPNode>
            <SATNode>
                <Saturation>1.000000</Saturation>
            </SATNode>
        </ColorCorrection>
        <ColorCorrection id="B001C002_220507_R6VL">
            <SOPNode>
                <Slope>1.000000 1.000000 1.000000</Slope>
                <Offset>0.000000 0.000000 0.000000</Offset>
                <Power>1.000000 1.000000 1.000000</Power>
            </SOPNode>
            <SATNode>
                <Saturation>1.000000</Saturation>
            </SATNode>
        </ColorCorrection>`,
    `<?xml version="1.0" encoding="UTF-8"?>
    <ColorDecisionList xmlns="urn:ASC:CDL:v1.01">
        <ColorDecision>
            <ColorCorrection id="B001C001_220507_R6VL">
                <SOPNode>
                    <Slope>1.000000 1.000000 1.000000</Slope>
                    <Offset>0.000000 0.000000 0.000000</Offset>
                    <Power>1.000000 1.000000 1.000000</Power>
                </SOPNode>
                <SATNode>
                    <Saturation>1.000000</Saturation>
                </SATNode>
            </ColorCorrection>
        </ColorDecision>
        <ColorDecision>
            <ColorCorrection id="B001C002_220507_R6VL">
                <SOPNode>
                    <Slope>1.000000 1.000000 1.000000</Slope>
                    <Offset>0.000000 0.000000 0.000000</Offset>
                    <Power>1.000000 1.000000 1.000000</Power>
                </SOPNode>
                <SATNode>
                    <Saturation>1.000000</Saturation>
                </SATNode>
            </ColorCorrection>
        </ColorDecision>`
];

/* 
// Testing
const color_item_set = new ColorItemSet();

for ( let i = 0; i < cdl_sample_files.length; i++ ) {
    color_item_set.parse_xml( cdl_sample_files[i], false );
}

for ( let i = 0; i < color_item_set.items.length; i++ ) {
    console.log( color_item_set.items[i]._color_instruction );
}
*/
