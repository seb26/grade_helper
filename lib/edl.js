/* Sebastian Reategui */

// LIBS
// const Timecode = require('timecode-boss');

// DEFAULTS
const EDL_DEFAULT_FPS_UNSPECIFIED = 25;
const EDL_DEFAULT_TIMELINE_RECORD_START_TC = '01:00:00:00';

// TEMPLATES
const EDL_HEADER_TITLE = (title) => `TITLE: ${title}`
const EDL_HEADER_FRAMETYPE = 'FCM: NON-DROP FRAME';
const EDL_EVENT = (
    index,
    reel,
    event_type,
    transition_type,
    source_tc_in,
    source_tc_out,
    record_tc_in,
    record_tc_out,
    ASC_SOP,
    ASC_SAT,
) => `${index}  ${reel} ${event_type}     ${transition_type}        ${source_tc_in} ${source_tc_out} ${record_tc_in} ${record_tc_out}`
const EDL_ASC_CC_XML = (ccc_id) => `*ASC_CC_XML ${ccc_id}`
const EDL_ASC_SOP = (sop) => `COMMENT:*ASC_SOP ${sop}`
const EDL_ASC_SAT = (sat) => `COMMENT:*ASC_SAT ${sat}`

class EDLClip {
    constructor(
        reel,
        source_tc_in,
        source_tc_out,
        fps,
        ASC_SOP = undefined,
        ASC_SAT = undefined,
        ASC_CC_XML = undefined,
        event_type = 'V',
        transition_type ='C',
    ) {
        if ( !source_tc_in && !source_tc_out ) {
            throw new Error('edl.js: new Clip: source_TC must be defined');
        }
        this.reel = reel;
        this.source_tc_in = new Timecode(source_tc_in, fps);
        this.source_tc_out = new Timecode(source_tc_out, fps);
        this.fps = fps;
        this.ASC_SOP = ASC_SOP;
        this.ASC_SAT = ASC_SAT;
        this.ASC_CC_XML = ASC_CC_XML;
        this.event_type = event_type;
        this.transition_type = transition_type;
    }
}

class EDL {
    /*
    This is a limited EDL library that only allows addition of new clip events from scratch.
    At present it does not offer parsing of existing EDL files.
    */
    constructor() {
        this.events = [];
    }
    add_event_to_timeline_sequentially(clip) {
        /* Adds full clip to timeline */
        var record_tc_in;
        var record_tc_out;
    	var duration = clip.source_tc_out.subtract(clip.source_tc_in);
        // Calculate recordTC
        if ( this.events[this.events.length - 1] ) {
            // Gather recordTC from last clip on timeline
            var last_event = this.events[this.events.length - 1];
            record_tc_in = last_event.record_tc_out;
            record_tc_out = record_tc_in.add(duration);
        }
        else {
            // Beginning of timeline
            record_tc_in = new Timecode(EDL_DEFAULT_TIMELINE_RECORD_START_TC, clip.fps);
            record_tc_out = record_tc_in.add(duration);
        }
        clip.record_tc_in = record_tc_in;
        clip.record_tc_out = record_tc_out;
        this.events.push(clip);
    }
    export(title) {
        var edl_lines = [];
        // Title
        if ( !title ) {
            title = '';
        }
        edl_lines.push( EDL_HEADER_TITLE(title) );
        // Drop frame indication
        edl_lines.push( EDL_HEADER_FRAMETYPE );
        edl_lines.push('');
        for ( var i = 0; this.events.length > i; i++) {
            var event = this.events[i];
            var event_index_num = i + 1;
            var event_line = EDL_EVENT(
                String(event_index_num).padStart(3, '0'),
                event.reel,
                event.event_type,
                event.transition_type,
                event.source_tc_in,
                event.source_tc_out,
                event.record_tc_in,
                event.record_tc_out,
            );
            edl_lines.push(event_line);
            if ( event.ASC_SOP && event.ASC_SAT) {
                edl_lines.push( EDL_ASC_SOP(event.ASC_SOP) );
                edl_lines.push( EDL_ASC_SAT(event.ASC_SAT) );
            }
            if ( event.ASC_CC_XML ) {
                edl_lines.push( EDL_ASC_CC_XML(event.ASC_CC_XML) );
            }
            edl_lines.push('');
        }
        var edl_data = edl_lines.join('\r\n');
        return edl_data;
    }
}