var object = {};
object.id = Symbol('id here');

var list_of_objects = [];
list_of_objects.push(object);

console.log(list_of_objects);

var filtered = list_of_objects.filter(item => item.id = object.id);

console.log('filtered', filtered);