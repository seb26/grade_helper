function check_overlap_i(lineA, lineB) {
    return lineA.start >= lineB.start && lineA.start <= lineB.end || 
        lineA.end >= lineB.start && lineA.end <= lineB.end ||
        lineB.start >= lineA.start && lineB.start <= lineA.end || 
        lineB.end >= lineA.start && lineB.end <= lineA.end;
}

function check_overlap_ii(one, two) {
    return ( one.end - two.start > 0 ) && ( two.end - one.start > 0 );
}

function check_overlap_iii(x1, x2, y1, y2) {
    return ( x2 - y1 > 0 ) && ( y2 - x1 > 0 );
}

function check_overlap_iv(x1, x2, y1, y2) {
    return ( x1 <= y2 && y1 <= x2 );
}


ocn_clip = { start: 1410592, end: 1411155 };

grades = [
    { start: 1410571, end: 1411171, label: 'grade' },
    { start: 1411491, end: 1412030, label: 'subsequent_grade' },
    { start: 1410571, end: 1410572, label: 'grade_single_frame_before_rec' },
    { start: 1410599, end: 1410600, label: 'grade_single_frame_after_rec' },
];


grades.forEach( (test) => {
    console.log( 'function i: ', check_overlap_i(ocn_clip, test), test.label );
    console.log( 'function ii: ', check_overlap_ii(ocn_clip, test), test.label );
    console.log( 'function iii: ', check_overlap_iii(ocn_clip.start, ocn_clip.end, test.start, test.end), test.label );
    console.log( 'function iv: ', check_overlap_iv(ocn_clip.start, ocn_clip.end, test.start, test.end), test.label );
    console.log('');
})