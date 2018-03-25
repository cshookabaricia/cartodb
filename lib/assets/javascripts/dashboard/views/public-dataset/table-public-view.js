const $ = require('jquery');
const Backbone = require('backbone');
const CoreView = require('backbone/core-view');
const UserModel = require('dashboard/data/user-model');
const AuthenticatedUserModel = require('dashboard/data/authenticated-user-model');
const SQLViewData = require('dashboard/data/table/sqlviewdata-model');
const PublicCartoTableMetadata = require('./public-carto-table-metadata');
const PublicHeader = require('./public-header/public-header');
const PublicTableTab = require('dashboard/views/public-dataset/table-tab/public-table-tab');
const TabPane = require('dashboard/components/tabpane/tabpane');
const Tabs = require('dashboard/components/tabs/tabs');
const checkAndBuildOpts = require('builder/helpers/required-opts');

const REQUIRED_OPTS = [
  'configModel'
];

/**
 *  Table public view
 *
 */

module.exports = CoreView.extend({

  events: {
    'click .js-Navmenu-link--download': '_exportTable',
    'click .js-Navmenu-link--api': '_apiCallTable'
  },

  initialize: function (options) {
    checkAndBuildOpts(options, REQUIRED_OPTS, this);
    this._initModels();
    this._initViews();
    this._initBinds();
  },

  _initModels: function () {
    // Table
    this.table = new PublicCartoTableMetadata({
      configModel: this._configModel,
      id: this.options.table_name,
      name: this.options.table_name,
      description: this.options.vizjson.description || ''
    });

    this.table.set({
      user_name: this.options.user_name,
      vizjson: this.options.vizjson,
      schema: this.options.schema
    });

    this.columns = this.table.data();
    this.sqlView = new SQLViewData(null, {
      configModel: this._configModel
    });
    this.sqlView.syncMethod = 'read';

    var query = this.query = this.table.data().getSQL();
    this.table.useSQLView(this.sqlView);
    this.sqlView.options.set('rows_per_page', 20, { silent: true });
    this._fetchData(query);

    // User
    this.user = new UserModel({ username: this.options.user_name });

    // Authenticated user
    this.authenticated_user = new AuthenticatedUserModel();
  },

  _initViews: function () {
    // Public header
    if (this.$('.cartodb-public-header').length > 0) {
      var header = new PublicHeader({
        el: this.$('.cartodb-public-header'),
        model: this.authenticated_user,
        vis: this.table,
        current_view: this._getCurrentView(),
        owner_username: this.options.owner_username,
        isMobileDevice: this.options.isMobileDevice
      });
      this.addView(header);

      // Fetch authenticated user model
      this.authenticated_user.fetch();
    }

    // Navigation
    // TODO: this is insanely complex for just two buttons
    // this.header = new cdb.open.PublicHeader({
    //   el: this.$('.navigation'),
    //   model: this.table,
    //   user: this.user,
    //   belong_organization: belong_organization,
    //   config: this.options.config
    // });
    // this.addView(this.header);

    // Tabpanes
    this.workViewTable = new TabPane({
      el: this.$('.pane_table')
    });
    this.addView(this.workViewTable);

    this.workViewMap = new TabPane({
      el: this.$('.pane_map')
    });
    this.addView(this.workViewMap);

    this.workViewMobile = new TabPane({
      el: this.$('.panes_mobile')
    });
    this.addView(this.workViewMobile);

    // Public app tabs
    this.tabs = new Tabs({
      el: this.$('.navigation ul'),
      slash: true
    });

    this.addView(this.tabs);

    // Help tooltip
    // var tooltip = new cdb.common.TipsyTooltip({
    //   el: this.$('span.help'),
    //   gravity: $.fn.tipsy.autoBounds(250, 's')
    // });
    // this.addView(tooltip);

    // Table tab
    this.tableTab = new PublicTableTab({
      configModel: this._configModel,
      model: this.table,
      vizjson: this.options.vizjson,
      user_name: this.options.user_name
    });

    this.tableTabMobile = new PublicTableTab({
      configModel: this._configModel,
      model: this.table,
      vizjson: this.options.vizjson,
      user_name: this.options.user_name
    });

    // // Map tab
    // this.mapTab = new cdb.open.PublicMapTab({
    //   vizjson: this.options.vizjson,
    //   auth_token: this.options.auth_token,
    //   https: this.options.https,
    //   vizjson_url: this.options.vizjson_url,
    //   model: new Backbone.Model({
    //     bounds: false
    //   })
    // });
    // this.mapTab.bind('mapBoundsChanged', function (options) {
    //   self.model.set('map', {
    //     bounds: [
    //       options.map.get('view_bounds_ne')[1],
    //       options.map.get('view_bounds_ne')[0],
    //       options.map.get('view_bounds_sw')[1],
    //       options.map.get('view_bounds_sw')[0]
    //     ],
    //     center: options.map.get('center'),
    //     zoom: options.map.get('zoom')
    //   });
    // });
    // this.mapTab.bind('boundsChanged', function (options) {
    //   self.model.set('bounds', options.bounds);
    // });

    // this.mapTabMobile = new cdb.open.PublicMapTab({
    //   vizjson: this.options.vizjson,
    //   auth_token: this.options.auth_token,
    //   https: this.options.https,
    //   vizjson_url: this.options.vizjson_url,
    //   model: new Backbone.Model({
    //     bounds: false
    //   })
    // });
    // this.mapTabMobile.bind('mapBoundsChanged', function (options) {
    //   self.model.set('map', {
    //     bounds: [
    //       options.map.get('view_bounds_ne')[1],
    //       options.map.get('view_bounds_ne')[0],
    //       options.map.get('view_bounds_sw')[1],
    //       options.map.get('view_bounds_sw')[0]
    //     ],
    //     center: options.map.get('center'),
    //     zoom: options.map.get('zoom')
    //   });
    // });
    // this.mapTabMobile.bind('boundsChanged', function (options) {
    //   self.model.set('bounds', options.bounds);
    // });

    this.workViewMobile.addTab('table', this.tableTabMobile.render());
    // this.workViewMobile.addTab('map', this.mapTabMobile.render());
    // this.workViewMobile.bind('tabEnabled:map', this.mapTabMobile.enableMap, this.mapTabMobile);

    this.workViewTable.addTab('table', this.tableTab.render());
    // this.workViewMap.addTab('map', this.mapTab.render());

    this.workViewMobile.bind('tabEnabled', (mode) => {
      this.$el.removeClass('table');
      this.$el.removeClass('map');
      this.$el.addClass(mode);
      $(window).trigger('resize');
    }, this.mapTabMobile);

    this.workViewMobile.bind('tabEnabled', this.tabs.activate);
    this.workViewMobile.active('table');

    this.workViewTable.active('table');
    this.workViewMap.active('map');
    // this.mapTab.enableMap();

    $('.pane_table').addClass('is-active');
  },

  _updateTable: function () {
    var sql = (this.model.get('bounds') && this.model.get('map')) ? (this.query + ' WHERE the_geom && ST_MakeEnvelope(' + this.model.get('map')['bounds'][0] + ', ' + this.model.get('map')['bounds'][1] + ', ' + this.model.get('map')['bounds'][2] + ', ' + this.model.get('map')['bounds'][3] + ', 4326)') : this.query;
    this._fetchData(sql);
  },

  _fetchData: function (sql) {
    if (sql) {
      this.sqlView.setSQL(sql);
    }

    this.sqlView.fetch({
      success: () => {
        this.$('.js-spinner').remove();
      }
    });
  },

  _exportTable: function (e) {
    e.preventDefault();

    // If a sql is applied but it is not valid, don't let the user export it
    if (!this.sqlView.getSQL()) return false;

    var DialogView = cdb.editor.PublicExportView;
    var export_dialog = new DialogView({
      model: this.table,
      config: config,
      user_data: this.user.toJSON(),
      bounds: this.sqlView.getSQL() !== this.query
    });

    export_dialog
      .appendToBody()
      .open();
  },

  _apiCallTable: function (e) {
    e.preventDefault();

    // If a sql is applied but it is not valid, don't show the dialog
    if (!this.sqlView.getSQL()) return false;

    const api_dialog = cdb.editor.ViewFactory.createDialogByTemplate('common/dialogs/api_call', {
      url: cdb.config.getSqlApiUrl(),
      sql: this.sqlView.getSQL(),
      schema: this.table.attributes.original_schema.slice(0, 5),
      rows: this.table.dataModel.models
    });

    api_dialog
      .appendToBody()
      .open();
  },

  _initBinds: function () {
    var _this = this;

    this.model.bind('change:bounds', function () {
      _this._setBoundsCheckbox();
      _this._updateTable();
    }, this);

    this.model.bind('change:map', function () {
      _this._setBounds();
      _this._updateTable();
    }, this);

    this.authenticated_user.bind('change', this._onUserLogged, this);

    this.add_related_model(this.authenticated_user);
  },

  _setBoundsCheckbox: function () {
    this.mapTab.model.set('bounds', this.model.get('bounds'));
    this.mapTabMobile.model.set('bounds', this.model.get('bounds'));
  },

  _setBounds: function () {
    this.mapTab.model.set('map', this.model.get('map'));
    this.mapTabMobile.model.set('map', this.model.get('map'));
  },

  // Get type of current view
  // - It could be, dashboard, table or visualization
  _getCurrentView: function () {
    var pathname = location.pathname;

    if (pathname.indexOf('/tables/') !== -1) {
      return 'table';
    }

    if (pathname.indexOf('/viz/') !== -1) {
      return 'visualization';
    }

    // Other case -> dashboard (datasets, visualizations,...)
    return 'dashboard';
  },

  keyUp: function (e) {},

  _onUserLogged: function () {
    // Check if edit button should be visible
    if (this.options.owner_username === this.authenticated_user.get('username')) {
      this.$('.extra_options .edit').css('display', 'inline-block');
      this.$('.extra_options .oneclick').css('display', 'none');
    }
  }

});