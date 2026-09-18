import ChessBoard from "../components/ChessBoard";
import "../utils/StatsAndNavigation";
//any jscode NOT here because theyre getting imported


export default function ChessRoom() {
  return (
	<>
		<div className="grid grid-rows-3 grid-flow-col gap-4">
			<div className="row-span-3 ...">
				<Stats />
			</div>

			<div className="col-span-2 ...">
				<Navigation />
			</div>
			<div className="row-span-2 col-span-2 ...">
				<ChessBoard />
			</div>
		</div>
		<div className="grid gap-6 md:grid-cols-2">

	  	</div>
	</>
	);
}


