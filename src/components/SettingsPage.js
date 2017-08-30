import React from 'react';
import { Link } from 'react-router';
import { Checkbox, CheckboxGroup } from 'react-checkbox-group';
import AsyncButton from './common/AsyncButton';
import { VaultClient, VCUtils as Utils } from '../logics';

const emailIdString = [
  '',
  '2FA has changed',
  'Password has changed',
  'Payment pin has changed',
  'Phone number has changed',
  'Email is no longer linked to the account',
  'Account has been blocked',
  'Account has been unblock',
  'Successfully sent currency',
  'Successfully received currency',
  'Successfully withdrawn currency',
  'Successfully deposited currency',
  'Successfully exchanged currency',
  'Failed to send currency',
  'Failed to receive currency',
  'Failed to withdraw currency',
  'Failed to deposit currency',
  'Failed to exchange currency',
  'Processing request to withdraw currency',
  'Processing request to deposit currency',
  'Processing request to exchange currency',
  'Pocket has been activated',
];

const emailFilterOptions = emailIdString.slice(1).map((value, index) => {
  return { label: value, value: index + 1 };
});

function SubmitButton(props) {
  const { text, onSubmit, options = [] } = props;
  const handleClick = onSubmit.bind(undefined, ...options);
  return (
    <AsyncButton
      type="button"
      onClick={handleClick}
      pendingText="..."
      fulFilledText={text}
      rejectedText="Failed! Try Again"
      text={text}
    />
  );
}

function FilterCheckbox(props) {
  const { name, options, values, onChange, onSubmit, onSelectAll, onDeselectAll } = props;
  const checkboxes = options.map((option) => {
    const { label, value } = option;
    return <p key={value}><label><Checkbox value={value} />{label}</label></p>;
  });
  const style = {
    overflow: 'scroll',
    width: '30em',
    maxHeight: '9.5em',
  };
  return (
    <div>
      <div style={style}>
        <CheckboxGroup name={name} value={values} onChange={onChange}>
          {checkboxes}
        </CheckboxGroup>
      </div>
      <SubmitButton text="Update" onSubmit={onSubmit} />
      <button onClick={onSelectAll}>Select all</button>
      <button onClick={onDeselectAll}>Deselect all</button>
    </div>
  );
}

export default class SettingsPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loginInfo: null,
      emailIdFilter: [],
    };
    this.handleSelectAll = this.handleSelectAll.bind(this);
    this.handleDeselectAll = this.handleDeselectAll.bind(this);
    this.handleEmailIdFilterChange = this.handleEmailIdFilterChange.bind(this);
    this.handleEmailIdFilterApply = this.handleEmailIdFilterApply.bind(this);
  }

  componentDidMount() {
    const setResults = ([loginInfo, emailIdFilter]) => {
      this.setState({
        loginInfo,
        emailIdFilter,
      });
    };
    const getEmailIdFilter = (loginInfo) => {
      const { username } = loginInfo;
      return VaultClient.getEmailNotificationSettings(loginInfo, username);
    };
    const loginInfoPromise = VaultClient.getLoginInfo()
      .catch((err) => {
        console.error('getLoginInfo', err);
        return Promise.reject(err);
      });
    const emailIdFilterPromise = loginInfoPromise.then(getEmailIdFilter)
      .then((results) => {
        const { ids } = results;
        return Promise.resolve(ids);
      })
      .catch((err) => {
        console.error('getEmailIdFilter', err);
        return Promise.reject(err);
      });
    const promise = Promise.all([
      loginInfoPromise,
      emailIdFilterPromise,
    ]);
    this.cancelablePromise = Utils.makeCancelable(promise);
    this.cancelablePromise.promise
      .then(setResults)
      .catch((err) => {
        if (!(err instanceof Error) && err.isCanceled) {
          return;
        }
        alert('Failed to get login info / email notification ids');
      });
  }

  componentWillUnmount() {
    this.cancelablePromise.cancel();
  }

  handleEmailIdFilterChange(newValues) {
    this.setState({
      emailIdFilter: newValues,
    });
  }

  handleEmailIdFilterApply() {
    const { loginInfo, emailIdFilter } = this.state;
    const { username } = loginInfo;
    return VaultClient.setEmailNotificationSettings(loginInfo, username, emailIdFilter)
      .then((result) => {
        console.log('set email id filter:', result);
        alert('Updated');
        return Promise.resolve();
      })
      .catch((err) => {
        console.error('set email id filter:', err);
        alert('Failed to set filter: ' + err.message);
        return Promise.reject(err);
      });
  }

  handleSelectAll(event) {
    event.preventDefault();
    this.setState({
      emailIdFilter: emailIdString.slice(1).map((value, index) => index),
    });
  }

  handleDeselectAll(event) {
    event.preventDefault();
    this.setState({
      emailIdFilter: [],
    });
  }

  render() {
    let childComponents = null;
    if (this.state.loginInfo) {
      const { emailIdFilter } = this.state;
      childComponents = (
        <div>
          <h2>Email Notification</h2>
          <FilterCheckbox name="emailIdFilter" options={emailFilterOptions} values={emailIdFilter} onChange={this.handleEmailIdFilterChange} onSubmit={this.handleEmailIdFilterApply} onSelectAll={this.handleSelectAll} onDeselectAll={this.handleDeselectAll} />
        </div>
      );
    }
    return (
      <div className="home">
        <h1>Settings</h1>
        {childComponents}
        <br />
        <Link to="/main">Back to main page</Link>
      </div>
    );
  }
}
