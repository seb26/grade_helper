match_remarks_to_ocn_auto() {
  function _apply_match(ocn_clip, remark, fps) {
    remark.matched_ocn_clip = ocn_clip;
    remark.start_tc = new Timecode(remark.metadata.start_tc, fps);
    ocn_clip.matched_remarks.push(remark);
  }
  this.items[APP_REMARK].forEach((remark) => {
    this.items[APP_OCN_CLIP].every((ocn_clip) => {
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
      var match_found = false;
      patterns_clipidentifier.every((pattern) => {
        var ocn_clip_name_match = ocn_clip.name.match(pattern);
        var remark_clip_name_match = remark.identifier.match(pattern);
        if ((ocn_clip_name_match && remark_clip_name_match)) {
          if (ocn_clip_name_match[0] == remark_clip_name_match[0]) {
            // OCN clipidentifier matches the remark clip identifier
            match_found = true;
            return false;
          }
        }
        return true;
      });
      if ( !match_found ) {
        // If no match by identifier, no point judging further.
        return false; // Finished with OCN clips
      }
      else {
        // 2. THEN MATCH BY TIMECODE
        // Gather start & finish times
        if (remark.metadata.start_tc && ocn_clip.start_tc && ocn_clip.end_tc) {
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
        }
        // Check for match
        if ( overlap(ocn_clip_start_f, ocn_clip_end_f, remark_start_f, remark_end_f) ) {
          _apply_match(ocn_clip, remark, fps);
          return false; // Finished with OCN clips
        }
      }
      return true; // Next OCN clip
    });
    return true; // Next remark
  });
  this.populate_ocn_clips();
}

