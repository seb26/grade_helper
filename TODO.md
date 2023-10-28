## Bugs

* Page stretches to the right, something is too big and causing horizontal scroll.


## Functionality TODO

* Input OCN clips from ALE (e.g. from Resolve)
* Input grades from ALE (e.g. Scratch ALE from LiveGrade)
* Import paired EDL+CCC as a pair. Paired EDL+CCC can be imported as separate components. Export is supported after matching.

* Write proper About or Readme section to explain purpose, inputs and outputs

* Make page accessible from https://seb26.github.io/grade_helper/index.html. Currently URL is quite long because it points to the source file which is inside a directory and not named index.

* Output files as ALE -- include any metadata columns that were present on input files
* Output files as CSV -- include any metadata

* Output multiple files as zip (especially 20x CDL files).
    * Would also help users in Safari, currently can't download multiple files.
    * Make zip a checkbox option.



## Pipe dream ideas

* Visual display of grades
    * Calculate colour for slope, offset, power
    * Calculate master level for slope, offset, power
    * For each grade, calculate grade "hash" e.g. [d8fc0e] = to show that two grades are identical
        * However it should not be 6 hexadecimal digits, to avoid implying that the grade creates a hex #ffffff colour
        * Could potentially be in SEQUENCE, aka 1st unique grade = "1" and 2nd unique grade ="2" in order of their position within the set of grades

* Ad-hoc assign grades to clips
    Possibilities
    * Drag and drop a grade, on top of a clip to match
    * Select dropdowns (bad for lots & lots of grades, not very accessible)
