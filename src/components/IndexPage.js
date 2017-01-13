import React from 'react';
import { Link } from 'react-router';
import { CurrentLogin } from './Data';
import * as VaultClientDemo from '../logics/VaultClientDemo'

function ResendVerificationButton(props) {
  if(props.verified) {
    return null;
  }

  return (
    <form onSubmit={props.target.handleResendEmail}>
      <div>
        <input type="text" value={props.target.state.resendEmail} onChange={props.target.handleChange.bind(props.target, 'resendEmail')} />
      </div>
      <input type="submit" value="Resend verification" />
    </form>
  );
}

export default class IndexPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      resendEmail: CurrentLogin.loginInfo.blob.data.email
    }
    this.handleResendEmail = this.handleResendEmail.bind(this);
  }

  handleChange(name, event) {
    this.setState({[name]: event.target.value});
  }

  handleResendEmail(event) {
    console.log('Resend verification email');
    const activateLink = 'http://localhost:3000/activate';     // TODO

    VaultClientDemo.resendVerificationEmail(CurrentLogin.username, CurrentLogin.password, this.state.resendEmail, activateLink, CurrentLogin.loginInfo)
      .then(result => {
        alert('Verification email has been sent to ' + this.state.resendEmail);
        CurrentLogin.loginInfo.blob.data.email = this.state.resendEmail;
      }).catch(err => {
        alert('Verication email cannot be sent: ' + err.message);
      });
    event.preventDefault();
  }

  render() {
    return (
      <div className="home">
        <div>Welcome {CurrentLogin.username}!</div>
        <div>Ripple address: {CurrentLogin.loginInfo.blob.data.account_id}</div>
        <div>
          Email: {CurrentLogin.loginInfo.blob.data.email} [{CurrentLogin.loginInfo.verified?'Verified':'Not verified'}]
          <ResendVerificationButton verified={CurrentLogin.loginInfo.verified} target={this} />
        </div>
        <br/>
        <div>
          <Link to="/rename">Change username</Link>
          <br/>
          <Link to="/changepw">Change Password</Link>
          <br/>
          <Link to="/payment">Make Payment</Link>
        </div>
      </div>
    );
  }
}