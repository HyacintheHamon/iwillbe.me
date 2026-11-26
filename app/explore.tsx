import React from "react";
import { withAccount } from "../src/access-gate";
import { InterestDiscovery } from "../src/interest-discovery";
import { Page, Title, TopBar } from "../src/ui";

function Explore() {
  return (
    <Page header={<TopBar title="My map" />}>
      <Title>Try something new</Title>
      <InterestDiscovery custom />
    </Page>
  );
}

export default withAccount(Explore);
