## Bugs

* Pressing download 'CDLs' will download an empty file, when there are no matching grades at all.


## Currently working on
* Input files as ALE (e.g. Scratch ALE from LiveGrade)

* Visual display of grades
    * Calculate colour for slope, offset, power
    * Calculate master level for slope, offset, power
    * For each grade, calculate grade "hash" e.g. [d8fc0e] = to show that two grades are identical
    	* However it should not be 6 hexadecimal digits, to avoid implying that the grade creates a hex #ffffff colour
        * Could potentially be in SEQUENCE, aka 1st unique grade = "1" and 2nd unique grade ="2" in order of their position within the set of grades


## Functionality

* Ad-hoc assign grades to clips
	Possibilities
	* Drag and drop a grade, on top of a clip to match
	* Select dropdowns (bad for lots & lots of grades, not very accessible)

* Output files as ALE -- requires ALE writer
* Output files as CSV -- requires CSV writer

* Output multiple files as zip (especially 20x CDL files).
* Add field for custom name label - or date & time.

## Not supported

* Import paired EDL+CCC as a pair. Paired EDL+CCC can be imported as separate components. Export is supported after matching.