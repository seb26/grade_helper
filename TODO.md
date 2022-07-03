## Bugs
* Importing a clip that has no valid items will still appear in Input Filelist even though it is useless
    * Another way to show user that their file has 0 valid items? Warning?
* Pressing download 'CDLs' will download an empty file, when there are no matching grades at all.

* Import EDL - isn't perfect - trouble handling plain EDLs that have no comment lines

## Currently working on
* Input files as ALE (e.g. Scratch ALE from LiveGrade)


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