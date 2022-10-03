import axios from "axios";

namespace Deku {
  export async function getDekuInfo(dekuNodeUrl: string) {
    const dekuInfo = await axios.get(`${dekuNodeUrl}/api/v1/chain/info`);
    return dekuInfo.data as { consensus: string };
  }
}

export default Deku;
