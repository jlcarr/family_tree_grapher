// Functions for parsing GEDCOM files and rendering them to SVG

var scale_px = 50;
var family_data = {};


var individual_list_item = document.createElement('tr');

var individual_list_name = document.createElement('td');
individual_list_name.setAttribute('id','name-cell');
individual_list_item.appendChild(individual_list_name);

var individual_list_birthdate = document.createElement('td');
individual_list_birthdate.setAttribute('id','birthdate-cell');
individual_list_item.appendChild(individual_list_birthdate);

var individual_list_desc = document.createElement('td');
individual_list_desc.setAttribute('id','descendants-generations-cell');
individual_list_item.appendChild(individual_list_desc);

var individual_list_select = document.createElement('td');
individual_list_select.setAttribute('id','select-cell');
var individual_list_item_button = document.createElement('button');
individual_list_item_button.setAttribute('id','select-cell-button');
individual_list_item_button.textContent = "Select";
individual_list_select.appendChild(individual_list_item_button);
individual_list_item.appendChild(individual_list_select);

function get_individuals_list(GEDCOM_string, list_box){
	// Initial JSON parse of the file
	var GEDCOM_json = GEDCOM2JSON(GEDCOM_string);
	
	// Clean into family structure
	family_data = clean_GEDCOM_JSON(GEDCOM_json);
	console.log(JSON.stringify(family_data));
	
	list_box.innerHTML = '';
	var INDI_list = Object.entries(family_data['INDI_dict']);
	INDI_list.sort(
		function(a,b) {
			if (a[1]['descendant_generations'] < b[1]['descendant_generations']) return 1;
			if (a[1]['descendant_generations'] > b[1]['descendant_generations']) return -1;
			if (new Date(a[1]['birthdate']) > new Date(b[1]['birthdate'])) return 1;
			if (new Date(a[1]['descendant_generations']) < new Date(b[1]['birthdate'])) return -1;
			return 0;
		}
	);
	for (var [key, value] of INDI_list){
		var new_individual = individual_list_item.cloneNode(true);
		new_individual.querySelector('#name-cell').textContent = value['name'];
		new_individual.querySelector('#birthdate-cell').textContent = value['birthdate'];
		new_individual.querySelector('#descendants-generations-cell').textContent = value['descendant_generations'];
		new_individual.querySelector('#select-cell-button').setAttribute('onclick',"render_family_tree('"+key+"', document.getElementById('file-image'));");
		list_box.appendChild(new_individual);
	}
	return family_data;
}


function render_family_tree(ancestor_key, SVG_box){
	// Generate descendents tree
	var descendents_tree = generate_descendents_tree(family_data, ancestor_key);

	// Create the actual SVG element
	var SVG_element = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	SVG_element.setAttribute('xmlns', "http://www.w3.org/2000/svg");
	SVG_element.setAttribute('xmlns:xlink', "http://www.w3.org/1999/xlink");
	SVG_element.setAttribute('border', '1px solid black');
	console.log(JSON.stringify(descendents_tree));
	SVG_descendents_tree(descendents_tree, SVG_element);
	
	// Place on the canvas
	SVG_box.innerHTML = '';
	SVG_box.appendChild(SVG_element);
}


function GEDCOM2SVG(GEDCOM_string){
	// Initial JSON parse of the file
	var GEDCOM_json = GEDCOM2JSON(GEDCOM_string);
	
	// Clean into family structure
	var cleaned_GEDCOM_json = clean_GEDCOM_JSON(GEDCOM_json);
	
	// Generate descendents tree
	var descendents_tree = generate_descendents_tree(cleaned_GEDCOM_json);
	
	// Create the actual SVG element
	var SVG_element = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	SVG_element.setAttribute('xmlns', "http://www.w3.org/2000/svg");
	SVG_element.setAttribute('xmlns:xlink', "http://www.w3.org/1999/xlink");
	SVG_element.setAttribute('border', '1px solid black');
	SVG_descendents_tree(descendents_tree, SVG_element);
	
	return SVG_element;
}


function GEDCOM2JSON(GEDCOM_string){
	var return_value = {'children':[]};
	var obj_stack = [return_value];
	var lines = GEDCOM_string.split(/\r\n|\r|\n/);
	for (var line of lines){
		// Parse the line
		var tokens = line.split(' ');
		var depth = parseInt(tokens[0]);
		var tag = tokens[1];
		
		// Get the current object (should always pop at least once)
		while (depth < obj_stack.length) var current_obj = obj_stack.pop();
		
		// Check the current object status
		var new_obj = {'tag': tag, 'children': []};
		if (tokens.length > 2) new_obj['value'] = tokens.slice(2).join(' ');
		//console.log(line);
		current_obj['children'].push(new_obj)
		
		// Replace the current object on the stack, with new on top
		obj_stack.push(current_obj);
		obj_stack.push(new_obj);
	}
	return return_value;
}


function clean_GEDCOM_JSON(GEDCOM_json){
	// Clean into family structure
	var INDI_dict = {};
	var FAM_dict = {};
	for (var entity of GEDCOM_json['children']){
		// Individual
		if ('value' in entity && entity['value'] == 'INDI'){
			var new_INDI = {'spouse_fam':[]};
			for (var attribute of entity['children']){
				if (attribute['tag'] == 'NAME' && 'value' in attribute) new_INDI['name'] = attribute['value'];
				if (attribute['tag'] == 'SEX' && 'value' in attribute) new_INDI['sex'] = attribute['value'];
				if (attribute['tag'] == 'FAMS' && 'value' in attribute) new_INDI['spouse_fam'].push(attribute['value']);
				if (attribute['tag'] == 'FAMC' && 'value' in attribute) new_INDI['child_fam'] = attribute['value'];
				if (attribute['tag'] == 'BIRT'){
					for (var attribute_sub of attribute['children']){
						if (attribute_sub['tag'] == 'DATE' && 'value' in attribute_sub) new_INDI['birthdate'] = attribute_sub['value'];
					}
				}
			}
			INDI_dict[entity['tag']] = new_INDI;
		}
		// Family
		if ('value' in entity && entity['value'] == 'FAM'){
			var new_FAM = {'children':[]};
			for (var attribute of entity['children']){
				if (attribute['tag'] == 'HUSB' && 'value' in attribute) new_FAM['father'] = attribute['value'];
				if (attribute['tag'] == 'WIFE' && 'value' in attribute) new_FAM['mother'] = attribute['value'];
				if (attribute['tag'] == 'CHIL' && 'value' in attribute) new_FAM['children'].push(attribute['value']);
				if (attribute['tag'] == 'MARR'){
					for (var attribute_sub of attribute['children']){
						if (attribute_sub['tag'] == 'DATE' && 'value' in attribute_sub) new_FAM['marriage date'] = attribute_sub['value'];
					}
				}
			}
			FAM_dict[entity['tag']] = new_FAM;
		}
	}
	cleaned_GEDCOM_json = {'INDI_dict': INDI_dict, 'FAM_dict':FAM_dict};
	count_descendant_generations(cleaned_GEDCOM_json);
	return cleaned_GEDCOM_json;
}


function count_descendant_generations(cleaned_GEDCOM_json, search_set = null, target_key = null){
	if (!target_key){
		search_set = new Set(Object.keys(cleaned_GEDCOM_json['INDI_dict']));
		while (search_set.size > 0){
			target_key = search_set.values().next().value;
			count_descendant_generations(cleaned_GEDCOM_json, search_set, target_key);
		}
	}
	else {
		search_set.delete(target_key);
		var target = cleaned_GEDCOM_json['INDI_dict'][target_key];
		target['descendant_generations'] = 0;
		if (target['spouse_fam'].length){
			for (var family of target['spouse_fam']){
				for (var child of cleaned_GEDCOM_json['FAM_dict'][family]['children']){
					if (search_set.has(child)){
						count_descendant_generations(cleaned_GEDCOM_json, search_set, child);
					}
					child = cleaned_GEDCOM_json['INDI_dict'][child];
					target['descendant_generations'] = Math.max(target['descendant_generations'], child['descendant_generations']+1);
				}
			}
		}
	}
}


function generate_descendents_tree(cleaned_GEDCOM_json, ancestor_key){
	var INDI_dict = cleaned_GEDCOM_json.INDI_dict;
	var FAM_dict = cleaned_GEDCOM_json.FAM_dict;
	
	// Generate descendents tree
	var descendents_tree = {'key': ancestor_key, 'generation': 1}
	var search_stack = [descendents_tree]; //INDI_dict.keys().filter(indi => !('child_fam' in INDI_dict[indi]));
	while (search_stack.length){
		var curr = search_stack.pop();
		var curr_JSON = INDI_dict[curr['key']]
		curr['name'] = curr_JSON['name'];
		curr['birthdate'] = curr_JSON['birthdate'];
		if (curr_JSON['spouse_fam'].length){
			var curr_fam = FAM_dict[curr_JSON['spouse_fam'][0]];
			if ('mother' in curr_fam && curr_fam['mother'] != curr['key']) curr['spouse_key'] = curr_fam['mother'];
			if ('father' in curr_fam && curr_fam['father'] != curr['key']) curr['spouse_key'] = curr_fam['father'];
			if ('spouse_key' in curr) var spouse_JSON = INDI_dict[curr['spouse_key']];
			else var spouse_JSON = {'name':'?', 'birthdate':'?'};
			
			curr['spouse'] = spouse_JSON['name'];
			curr['spouse_birthdate'] = spouse_JSON['birthdate'];
			
			curr['children'] = [];
			for (var child of curr_fam['children']){
				var new_child = {'key': child, 'generation': curr['generation']+1};
				curr['children'].push(new_child);
				search_stack.push(new_child);
			}
		}
	}
	return descendents_tree;
}


function descendents_tree_widths(descendents_tree){
	if ('width' in descendents_tree) return descendents_tree['width'];
	var self_width = ('spouse' in descendents_tree) ? 2 : 1;
	if (!('children' in descendents_tree)){
		descendents_tree['width'] = self_width;
		return self_width;
	}
	const reducer = (total_width, child) => total_width + descendents_tree_widths(child);
	var children_width = descendents_tree['children'].reduce(reducer, 0);
	var width = Math.max(self_width, children_width);
	descendents_tree['width'] = width;
	return width;
}

function SVG_descendents_tree(descendents_tree, svg_element){
	const by_birthday = (a,b) => new Date(a['birthdate']) > new Date(b['birthdate'])? 1 : -1;
	// Build Initial offsets
	var stack = [];
	var offset_list = [];
	var generation_list = [];
	stack.push(descendents_tree);
	while (stack.length > 0){
		var curr = stack.pop();
		// Add children to stack
		if ('children' in curr) stack.push(...curr['children'].sort(by_birthday).reverse());
		
		// Update offset values
		if (offset_list.length < curr['generation']) offset_list.push(0);
		curr['offset'] = offset_list[curr['generation']-1];
		offset_list[curr['generation']-1]++;
		if ('spouse' in curr) offset_list[curr['generation']-1]++;
		
		// Add self to generation list
		if (generation_list.length < curr['generation']) generation_list.push([]);
		generation_list[curr['generation']-1].push(curr);
	}
	
	// Satisfy constraints
	stack.push(descendents_tree);
	while (stack.length > 0){
		var curr = stack.pop();
		// Add children to stack
		if ('children' in curr && curr['children'].length > 0) stack.push(...curr['children'].sort(by_birthday).reverse());
		else continue;
		
		var sorted_children_list = curr['children'].sort(by_birthday);
		
		// Get min-max children positions
		var min_child = sorted_children_list[0];
		var min_child_offset = min_child['offset'];
		if ('spouse' in min_child)
			if (new Date(min_child['birthdate']) > new Date(min_child['spouse_birthdate'])) min_child_offset++;
		var max_child = sorted_children_list[sorted_children_list.length-1];
		var max_child_offset = max_child['offset'];
		if ('spouse' in max_child)
			if (new Date(max_child['birthdate']) > new Date(max_child['spouse_birthdate'])) max_child_offset++;
		if (sorted_children_list.length >= 2) max_child_offset--;
		
		// Move all individuals up to children
		if (curr['offset'] < min_child_offset) {
			var offset_diff = min_child_offset - curr['offset'];
			var offset_base = curr['offset'];
			for (var individual of generation_list[curr['generation']-1])
				if (individual['offset'] >= offset_base) individual['offset'] += offset_diff;
		}
		// Move all children up to individual
		if (curr['offset'] > max_child_offset) {
			var offset_diff = curr['offset'] - max_child_offset;
			var offset_base = min_child['offset'];
			for (var individual of generation_list[curr['generation']])
				if (individual['offset'] >= offset_base) individual['offset'] += offset_diff;
		}
	}
	
	// Fetch min/max values
	var max_generation = 0;
	var max_width = 0;
	stack.push(descendents_tree);
	while (stack.length > 0){
		var curr = stack.pop();
		// Add children to stack
		if ('children' in curr) stack.push(...curr['children'].sort(by_birthday));
		
		max_generation = Math.max(max_generation, curr['generation']);
		max_width = Math.max(max_width, curr['offset']);
		if ('spouse' in curr) max_width = Math.max(max_width, 1+curr['offset']);
	}
	
	// Draw results
	svg_element.setAttribute('width', (4*max_width+6)*scale_px);
	svg_element.setAttribute('height', (2*max_generation+1)*scale_px);
	
	stack.push(descendents_tree);
	while (stack.length > 0){
		var curr = stack.pop();
		if ('children' in curr) stack.push(...curr['children']);
		
		var location = curr['offset'];
		var generation =  curr['generation'];
		
		add_individual_SVG(svg_element, curr['name'], (2*location+1)*2*scale_px, (2*generation-1)*scale_px);
		if ('spouse' in curr){
		 	add_individual_SVG(svg_element, curr['spouse'], (2*(location+1)+1)*2*scale_px, (2*generation-1)*scale_px);
			var spouse_line = document.createElementNS("http://www.w3.org/2000/svg", "line");
			spouse_line.setAttribute('x1', (2*location+2)*2*scale_px);
			spouse_line.setAttribute('y1', (2*generation-1/2)*scale_px);
			spouse_line.setAttribute('x2', (2*location+3)*2*scale_px);
			spouse_line.setAttribute('y2', (2*generation-1/2)*scale_px);
			spouse_line.setAttribute('stroke', 'black');
			svg_element.appendChild(spouse_line);
		}
		
		if ('children' in curr && curr['children'].length){
			// Drop line
			var children_line = document.createElementNS("http://www.w3.org/2000/svg", "line");
			children_line.setAttribute('x1', (2*location+5/2)*2*scale_px);
			children_line.setAttribute('y1', (2*generation-1/2)*scale_px);
			children_line.setAttribute('x2', (2*location+5/2)*2*scale_px);
			children_line.setAttribute('y2', (2*generation+1/2)*scale_px);
			children_line.setAttribute('stroke', 'black');
			svg_element.appendChild(children_line);
			
			
			// Get min-max children positions
			var sorted_children_list = curr['children'].sort(by_birthday);
			var min_child_offset = sorted_children_list[0]['offset'];
			var max_child_offset = sorted_children_list[sorted_children_list.length-1]['offset'];
			max_child_offset = Math.max(max_child_offset, location+1/2)
			
			// Sibling line
			var sibling_line = document.createElementNS("http://www.w3.org/2000/svg", "line");
			sibling_line.setAttribute('x1', (2*min_child_offset+3/2)*2*scale_px);
			sibling_line.setAttribute('y1', (2*generation+1/2)*scale_px);
			sibling_line.setAttribute('x2', (2*max_child_offset+3/2)*2*scale_px);
			sibling_line.setAttribute('y2', (2*generation+1/2)*scale_px);
			sibling_line.setAttribute('stroke', 'black');
			svg_element.appendChild(sibling_line);
		}
		
		if (generation != 1) {
			var children_line = document.createElementNS("http://www.w3.org/2000/svg", "line");
			children_line.setAttribute('x1', (2*location+3/2)*2*scale_px);
			children_line.setAttribute('y1', (2*generation-1)*scale_px);
			children_line.setAttribute('x2', (2*location+3/2)*2*scale_px);
			children_line.setAttribute('y2', (2*generation-3/2)*scale_px);
			children_line.setAttribute('stroke', 'black');
			svg_element.appendChild(children_line);
		}
	}
}


var individual_box = document.createElementNS("http://www.w3.org/2000/svg", "rect");
individual_box.setAttribute('rx', 5);
individual_box.setAttribute('ry', 5);
individual_box.setAttribute('width', 2*scale_px);
individual_box.setAttribute('height', scale_px);
individual_box.setAttribute('stroke', 'black');
individual_box.setAttribute('fill', 'none');
var individual_text = document.createElementNS("http://www.w3.org/2000/svg", "text");

function add_individual_SVG(svg_element, name, x, y){
	var new_individual = individual_box.cloneNode(true);
	new_individual.setAttribute('x', x);
	new_individual.setAttribute('y', y);
	svg_element.appendChild(new_individual);
	var new_individual = individual_text.cloneNode(true);
	new_individual.setAttribute('dominant-baseline', 'middle');
	new_individual.setAttribute('text-anchor', 'middle');
	new_individual.setAttribute('x', x + scale_px);
	new_individual.setAttribute('y', y + scale_px/2);
	new_individual.innerHTML = name;
	svg_element.appendChild(new_individual);
}
