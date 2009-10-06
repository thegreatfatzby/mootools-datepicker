/**
 * datepicker.js - MooTools Datepicker class
 * @version 1.16
 * 
 * by MonkeyPhysics.com
 *
 * Source/Documentation available at:
 * http://www.monkeyphysics.com/mootools/script/2/datepicker
 * 
 * --
 * 
 * Smoothly animating, very configurable and easy to install.
 * No Ajax, pure Javascript. 4 skins available out of the box.
 * 
 * --
 *
 * Some Rights Reserved
 * http://creativecommons.org/licenses/by-sa/3.0/
 * 
 */

var DatePicker = new Class({
	
	Implements: Options,
	
	// working date, which we will keep modifying to render the calendars
	d: '',
	
	// just so that we need not request it over and over
	today: '',
	
	// current user-choice in date object format
	choice: {}, 
	
	// size of body, used to animate the sliding
	bodysize: {}, 
	
	// to check availability of next/previous buttons
	limit: {}, 
	
	// element references:
	attachTo: null,    // selector for target inputs
	picker: null,      // main datepicker container
	slider: null,      // slider that contains both oldContents and newContents, used to animate between 2 different views
	oldContents: null, // used in animating from-view to new-view
	newContents: null, // used in animating from-view to new-view
	input: null,       // original input element (used for input/output)
	visual: null,      // visible input (used for rendering)
	
	options: { 
		pickerClass: 'datepicker',
		days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
		months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
		dayShort: 2,
		monthShort: 3,
		startDay: 1, // Sunday (0) through Saturday (6) - be aware that this may affect your layout, since the days on the right might have a different margin
		timePicker: false,
		clockStyle: 12,
		timePickerOnly: false,
		yearPicker: true,
		yearsPerPage: 20,
		format: 'd-m-Y',
		allowEmpty: false,
		inputOutputFormat: 'U', // default to unix timestamp
		animationDuration: 400,
		useFadeInOut: !Browser.Engine.trident, // dont animate fade-in/fade-out for IE
		startView: 'month', // allowed values: {time, month, year, decades}
		positionOffset: { x: 0, y: 0 },
		minDate: null, // { date: '[date-string]', format: '[date-string-interpretation-format]' }
		maxDate: null, // same as minDate
		debug: false,
		toggleElements: null,
		
		// and some event hooks:
		onShow: $empty,   // triggered when the datepicker pops up
		onClose: $empty,  // triggered after the datepicker is closed (destroyed)
		onSelect: $empty  // triggered when a date is selected
	},
	
	initialize: function(attachTo, options) {
		this.attachTo = attachTo;
		this.setOptions(options).attach();
		if (this.options.timePickerOnly) {
			this.options.timePicker = true;
			this.options.startView = 'time';
		}
		this.formatMinMaxDates();
		document.addEvent('mousedown', this.close.bind(this));
	},
	
	formatMinMaxDates: function() {
		if (this.options.minDate && this.options.minDate.format) {
			this.options.minDate = this.unformat(this.options.minDate.date, this.options.minDate.format);
		}
		if (this.options.maxDate && this.options.maxDate.format) {
			this.options.maxDate = this.unformat(this.options.maxDate.date, this.options.maxDate.format);
			this.options.maxDate.setHours(23);
			this.options.maxDate.setMinutes(59);
			this.options.maxDate.setSeconds(59);
		}
	},
	
	attach: function() {
		// toggle the datepicker through a separate element?
		if ($chk(this.options.toggleElements)) {
			var togglers = $$(this.options.toggleElements);
			document.addEvents({
				'keydown': function(e) {
					if (e.key == "tab") {
						this.close(null, true);
					}
				}.bind(this)
			});
		};
		
		// attach functionality to the inputs		
		$$(this.attachTo).each(function(item, index) {
			
			// never double attach
			if (item.retrieve('datepicker')) return;
			
			// determine starting value(s)
			if ($chk(item.get('value'))) {
				var init_clone_val = this.format(new Date(this.unformat(item.get('value'), this.options.inputOutputFormat)), this.options.format);
			} else if (!this.options.allowEmpty) {
				var init_clone_val = this.format(new Date(), this.options.format);
			} else {
				var init_clone_val = '';
			}
			
			// create clone
			var display = item.getStyle('display');
			var clone = item
			.setStyle('display', this.options.debug ? display : 'none')
			.store('datepicker', true) // to prevent double attachment...
			.clone()
			.store('datepicker', true) // ...even for the clone (!)
			.removeProperty('name')    // secure clean (form)submission
			.setStyle('display', display)
			.set('value', init_clone_val)
			.inject(item, 'after');
			
			// events
			if ($chk(this.options.toggleElements)) {
				togglers[index]
					.setStyle('cursor', 'pointer')
					.addEvents({
						'click': function(e) {
							this.onFocus(item, clone);
						}.bind(this)
					});
				clone.addEvents({
					'blur': function() {
						item.set('value', clone.get('value'));
					}
				});
			} else {
				clone.addEvents({
					'keydown': function(e) {
						if (this.options.allowEmpty && (e.key == "delete" || e.key == "backspace")) {
							item.set('value', '');
							e.target.set('value', '');
							this.close(null, true);
						} else if (e.key == "tab") {
							this.close(null, true);
						} else {
							e.stop();
						}
					}.bind(this),
					'focus': function(e) {
						this.onFocus(item, clone);
					}.bind(this)
				});
			}
		}.bind(this));
	},
	
	onFocus: function(original_input, visual_input) {
		var init_visual_date, d = visual_input.getCoordinates();
		
		if ($chk(original_input.get('value'))) {
			init_visual_date = this.unformat(original_input.get('value'), this.options.inputOutputFormat).valueOf();
		} else {
			init_visual_date = new Date();
			if ($chk(this.options.maxDate) && init_visual_date.valueOf() > this.options.maxDate.valueOf()) {
				init_visual_date = new Date(this.options.maxDate.valueOf());
			}
			if ($chk(this.options.minDate) && init_visual_date.valueOf() < this.options.minDate.valueOf()) {
				init_visual_date = new Date(this.options.minDate.valueOf());
			}
		}
		
		this.show({ left: d.left + this.options.positionOffset.x, top: d.top + d.height + this.options.positionOffset.y }, init_visual_date);
		this.input = original_input;
		this.visual = visual_input;
		this.options.onShow();
	},
	
	dateToObject: function(d) {
		return {
			year: d.getFullYear(),
			month: d.getMonth(),
			day: d.getDate(),
			hours: d.getHours(),
			minutes: d.getMinutes(),
			seconds: d.getSeconds()
		};
	},
	
	dateFromObject: function(values) {
		var d = new Date();
		d.setDate(1);
		['year', 'month', 'day', 'hours', 'minutes', 'seconds'].each(function(type) {
			var v = values[type];
			if (!$chk(v)) return;
			switch (type) {
				case 'day': d.setDate(v); break;
				case 'month': d.setMonth(v); break;
				case 'year': d.setFullYear(v); break;
				case 'hours': d.setHours(v); break;
				case 'minutes': d.setMinutes(v); break;
				case 'seconds': d.setSeconds(v); break;
			}
		});
		return d;
	},
	
	show: function(position, timestamp) {
		this.formatMinMaxDates();
		if ($chk(timestamp)) {
			this.d = new Date(timestamp);
		} else {
			this.d = new Date();
		}
		this.today = new Date();
		this.choice = this.dateToObject(this.d);
		this.mode = (this.options.startView == 'time' && !this.options.timePicker) ? 'month' : this.options.startView;
		this.render();
		this.picker.setStyles(position);
	},
	
	render: function(fx) {
		if (!$chk(this.picker)) {
			this.constructPicker();
		} else {
			// swap contents so we can fill the newContents again and animate
			var o = this.oldContents;
			this.oldContents = this.newContents;
			this.newContents = o;
			this.newContents.empty();
		}
		
		// remember current working date
		var startDate = new Date(this.d.getTime());
		
		// intially assume both left and right are allowed
		this.limit = { right: false, left: false };
		
		// render! booty!
		if (this.mode == 'decades') {
			this.renderDecades();
		} else if (this.mode == 'year') {
			this.renderYear();
		} else if (this.mode == 'time') {
			this.renderTime();
			this.limit = { right: true, left: true }; // no left/right in timeview
		} else {
			this.renderMonth();
		}
		
		this.picker.getElement('.previous').setStyle('visibility', this.limit.left ? 'hidden' : 'visible');
		this.picker.getElement('.next').setStyle('visibility', this.limit.right ? 'hidden' : 'visible');
		this.picker.getElement('.titleText').setStyle('cursor', this.allowZoomOut() ? 'pointer' : 'default');
		
		// restore working date
		this.d = startDate;
		
		// if ever the opacity is set to '0' it was only to have us fade it in here
		// refer to the constructPicker() function, which instantiates the picker at opacity 0 when fading is desired
		if (this.picker.getStyle('opacity') == 0) {
			this.picker.tween('opacity', 0, 1);
		}
		
		// animate
		if ($chk(fx)) this.fx(fx);
	},
	
	fx: function(fx) {
		if (fx == 'right') {
			this.oldContents.setStyles({ left: 0, opacity: 1 });
			this.newContents.setStyles({ left: this.bodysize.x, opacity: 1 });
			this.slider.setStyle('left', 0).tween('left', 0, -this.bodysize.x);
		} else if (fx == 'left') {
			this.oldContents.setStyles({ left: this.bodysize.x, opacity: 1 });
			this.newContents.setStyles({ left: 0, opacity: 1 });
			this.slider.setStyle('left', -this.bodysize.x).tween('left', -this.bodysize.x, 0);
		} else if (fx == 'fade') {
			this.slider.setStyle('left', 0);
			this.oldContents.setStyle('left', 0).set('tween', { duration: this.options.animationDuration / 2 }).tween('opacity', 1, 0);
			this.newContents.setStyles({ opacity: 0, left: 0}).set('tween', { duration: this.options.animationDuration }).tween('opacity', 0, 1);
		}
	},
	%0