import React from 'react';
import { TidePayAPI, VCUtils as Utils } from '../../logics';

export default class AccountBalanceTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      balances: {},
    };
  }

  componentDidMount() {
    const { address } = this.props;
    const setBalances = ([balances, exchangeRates]) => {
      const balanceObj = balances.lines.reduce((acc, curr) => {
        const { rates: map } = exchangeRates;
        const rates = map[curr.currency];
        const balance = {
          value: curr.balance,
        };
        if (rates) {
          balance.valueInUSD = curr.balance * rates.USD;
        }
        return {
          ...acc,
          [curr.currency]: balance,
        };
      }, {});
      this.setState({
        balances: balanceObj,
      });
      this.props.onGetAccountBalances(balanceObj);
    };
    const accountBalancesPromise = TidePayAPI.getAccountBalances(address);
    const exchangeRatesPromise = accountBalancesPromise
      .then((balances) => {
        const bases = balances.lines.map(line => line.currency);
        return TidePayAPI.getExchangeRate(bases, 'USD');
      });
    const promise = Promise.all([
      accountBalancesPromise,
      exchangeRatesPromise,
    ]);
    this.balanceCancelablePromise = Utils.makeCancelable(promise);
    this.balanceCancelablePromise.promise
      .then(setBalances)
      .catch((err) => {
        if (err instanceof Error) {
          alert('Failed to get account balances');
          console.log('getAccountBalances', err);
        }
      });
  }

  componentWillUnmount() {
    this.balanceCancelablePromise.cancel();
  }

  render() {
    const { balances } = this.state;
    const rows = [];
    Object.keys(balances).forEach((key) => {
      const balance = balances[key];
      const {
        value,
        valueInUSD = '-',
      } = balance;
      rows.push(
        <tr key={key}>
          <td>{key}</td>
          <td>{value}</td>
          <td>{valueInUSD}</td>
        </tr>
      );
    });

    if (rows.length === 0) {
      return (
        <div>
          No currency!
        </div>
      );
    }

    return (
      <table>
        <thead>
          <tr>
            <td width="100">Currency</td>
            <td width="200">Value</td>
            <td width="200">USD Value</td>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    );
  }
}
